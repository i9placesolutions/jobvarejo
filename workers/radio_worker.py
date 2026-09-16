#!/usr/bin/env python3
"""Worker durável da Rádio Indoor do JobVarejo.

O processo atende todas as lojas da conta. A fila fica no PostgreSQL e cada
rodada usa ``FOR UPDATE SKIP LOCKED`` com lease, portanto duas réplicas podem
rodar ao mesmo tempo sem pegar o mesmo tick. O player continua calculando a
faixa ativa; o worker mantém os ticks de agenda observáveis e prontos para
integrações futuras (AudioPack, comerciais e áudio gerado pelo MusicGPT).

Teste local (carregando o .env):
    set -a; source .env; set +a
    ./workers/start-radio-worker.sh --once --dry-run

Produção: mantenha este processo como um serviço separado do node-server.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import socket
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg


LOGGER = logging.getLogger("radio-indoor-worker")
STOP = False


def stop_handler(_signum: int, _frame: object) -> None:
    global STOP
    STOP = True


def database_url() -> str:
    value = (
        os.getenv("POSTGRES_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("NUXT_POSTGRES_DATABASE_URL")
        or os.getenv("TARGET_DATABASE_URL")
    )
    if not value:
        raise RuntimeError("POSTGRES_DATABASE_URL não configurada")
    return value


def env_int(name: str, fallback: int) -> int:
    try:
        return int(os.getenv(name, str(fallback)))
    except (TypeError, ValueError):
        return fallback


def worker_id() -> str:
    configured = str(os.getenv("RADIO_WORKER_ID", "")).strip()
    if configured:
        return configured[:160]
    return f"{socket.gethostname()}:{os.getpid()}"[:160]


WORKER_ID = worker_id()
WORKER_HOST = socket.gethostname()[:255]
WORKER_PID = os.getpid()


def heartbeat_metadata(**extra: Any) -> str:
    data: dict[str, Any] = {"workerId": WORKER_ID, "host": WORKER_HOST, "pid": WORKER_PID}
    data.update(extra)
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def upsert_heartbeat(cursor: Any, status: str, metadata: str, reset_started_at: bool = False) -> None:
    """Registra a presença do processo sem deixar segredos no metadata."""
    cursor.execute(
        """
        insert into public.radio_worker_heartbeats
          (worker_id, host, pid, status, started_at, last_seen_at, stopped_at, metadata)
        values (%s, %s, %s, %s, now(), now(), %s, %s::jsonb)
        on conflict (worker_id) do update set
          host = excluded.host,
          pid = excluded.pid,
          status = excluded.status,
          started_at = case when %s then now() else radio_worker_heartbeats.started_at end,
          last_seen_at = now(),
          stopped_at = excluded.stopped_at,
          metadata = excluded.metadata,
          updated_at = now()
        """,
        (
            WORKER_ID,
            WORKER_HOST,
            WORKER_PID,
            status,
            datetime.now(timezone.utc) if status in ("stopped", "error") else None,
            metadata,
            reset_started_at,
        ),
    )


def set_heartbeat(status: str, *, reset_started_at: bool = False, **metadata: Any) -> None:
    """Atualiza o heartbeat em uma conexão curta; falha de heartbeat não para a fila."""
    try:
        with psycopg.connect(database_url()) as connection:
            with connection.cursor() as cursor:
                try:
                    upsert_heartbeat(cursor, status, heartbeat_metadata(**metadata), reset_started_at)
                except psycopg.errors.UndefinedTable:
                    connection.rollback()
                    LOGGER.error(
                        "Tabela de heartbeat ausente; aplique database/radio_indoor_migration.sql"
                    )
                    return
            connection.commit()
    except Exception:
        LOGGER.exception("não foi possível atualizar o heartbeat (%s)", status)


def claim_jobs(*, dry_run: bool, batch_size: int, lease_seconds: int, max_attempts: int) -> list[dict[str, Any]]:
    """Seleciona ou reivindica ticks vencidos de qualquer loja."""
    with psycopg.connect(database_url()) as connection:
        with connection.cursor() as cursor:
            try:
                cursor.execute(
                    """
                    with candidates as (
                      select id
                        from public.radio_schedule_jobs
                       where (
                           (status = 'pending' and due_at <= now() and attempts < %s)
                           or (status = 'running' and (lease_until is null or lease_until <= now()))
                         )
                       order by due_at, id
                       for update skip locked
                       limit %s
                    ), claimed as (
                      update public.radio_schedule_jobs job
                         set status = 'running',
                             attempts = job.attempts + 1,
                             lease_until = now() + (%s * interval '1 second'),
                             updated_at = now()
                        from candidates
                       where job.id = candidates.id
                      returning job.id, job.user_id, job.station_id, job.schedule_id,
                                job.due_at, job.kind, job.attempts, job.payload
                    )
                    select id, user_id, station_id, schedule_id, due_at, kind, attempts, payload
                      from claimed
                     order by due_at, id
                    """,
                    (max_attempts, batch_size, lease_seconds),
                )
                rows = cursor.fetchall()
            except psycopg.errors.UndefinedTable:
                connection.rollback()
                LOGGER.error("Tabelas da Rádio Indoor ausentes; aplique database/radio_indoor_migration.sql")
                return []

            jobs = [
                {
                    "id": row[0],
                    "user_id": row[1],
                    "station_id": row[2],
                    "schedule_id": row[3],
                    "due_at": row[4],
                    "kind": row[5],
                    "attempts": int(row[6] or 0),
                    "payload": row[7] or {},
                }
                for row in rows
            ]
            # No dry-run, a seleção deve deixar a fila intacta. O rollback
            # também libera imediatamente os locks usados pelo SELECT.
            if dry_run:
                connection.rollback()
            else:
                connection.commit()
            return jobs


def next_due_at(due_at: datetime) -> datetime:
    now = datetime.now(timezone.utc)
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=timezone.utc)
    return max(now + timedelta(minutes=1), due_at + timedelta(minutes=1))


def handle_job(job: dict[str, Any], *, max_attempts: int) -> None:
    """Finaliza um tick e agenda o próximo somente se a agenda ainda estiver ativa."""
    job_id = job["id"]
    schedule_id = job.get("schedule_id")
    try:
        with psycopg.connect(database_url()) as connection:
            with connection.cursor() as cursor:
                schedule = None
                if schedule_id:
                    cursor.execute(
                        """
                        select id, user_id, station_id, enabled,
                               (starts_on is null or current_date >= starts_on)
                                 and (ends_on is null or current_date <= ends_on) as in_date_range
                          from public.radio_schedules
                         where id = %s and user_id = %s and station_id = %s
                         limit 1
                        """,
                        (schedule_id, job["user_id"], job["station_id"]),
                    )
                    schedule = cursor.fetchone()

                active_schedule = bool(schedule and schedule[3] and schedule[4])
                cursor.execute(
                    """
                    update public.radio_schedule_jobs
                       set status = 'done', attempts = attempts,
                           lease_until = null, last_error = null, updated_at = now()
                     where id = %s
                    """,
                    (job_id,),
                )
                if active_schedule and schedule_id:
                    due_at = next_due_at(job["due_at"])
                    idempotency = f"{schedule_id}:{due_at.isoformat()}"
                    cursor.execute(
                        """
                        insert into public.radio_schedule_jobs
                          (user_id, station_id, schedule_id, due_at, kind, idempotency_key, payload)
                        values (%s, %s, %s, %s, 'schedule_tick', %s, '{}'::jsonb)
                        on conflict (idempotency_key) do nothing
                        """,
                        (job["user_id"], job["station_id"], schedule_id, due_at, idempotency),
                    )
            connection.commit()
    except psycopg.errors.UndefinedTable:
        raise
    except Exception as error:
        error_text = str(error).replace("\x00", "")[:1000]
        LOGGER.exception("falha no job %s", job_id)
        try:
            with psycopg.connect(database_url()) as connection:
                with connection.cursor() as cursor:
                    attempts = int(job.get("attempts") or 1)
                    terminal = attempts >= max_attempts
                    # Backoff crescente, limitado a uma hora, para não ocupar
                    # a fila quando uma dependência ficar indisponível.
                    delay_minutes = min(60, max(1, 2 ** min(attempts - 1, 5)))
                    cursor.execute(
                        """
                        update public.radio_schedule_jobs
                           set status = %s,
                               due_at = case when %s then due_at else now() + (%s * interval '1 minute') end,
                               lease_until = null,
                               last_error = %s,
                               updated_at = now()
                         where id = %s
                        """,
                        ("failed" if terminal else "pending", terminal, delay_minutes, error_text, job_id),
                    )
                connection.commit()
        except Exception:
            LOGGER.exception("não foi possível registrar a falha do job %s", job_id)


def process_once(*, dry_run: bool = False, batch_size: int = 20, lease_seconds: int = 120, max_attempts: int = 5) -> int:
    status = "dry_run" if dry_run else "running"
    set_heartbeat(
        status,
        reset_started_at=False,
        dryRun=dry_run,
        batchSize=batch_size,
        leaseSeconds=lease_seconds,
        maxAttempts=max_attempts,
    )
    jobs = claim_jobs(
        dry_run=dry_run,
        batch_size=batch_size,
        lease_seconds=lease_seconds,
        max_attempts=max_attempts,
    )
    for job in jobs:
        LOGGER.info(
            "tick %s station=%s schedule=%s kind=%s attempts=%s%s",
            job["id"],
            job["station_id"],
            job["schedule_id"],
            job["kind"],
            job["attempts"],
            " (dry-run)" if dry_run else "",
        )
        if not dry_run:
            handle_job(job, max_attempts=max_attempts)
    return len(jobs)


def main() -> None:
    parser = argparse.ArgumentParser(description="Worker da Rádio Indoor do JobVarejo")
    parser.add_argument("--once", action="store_true", help="processa uma rodada e encerra")
    parser.add_argument("--dry-run", action="store_true", help="lê a fila sem alterar os jobs (heartbeat operacional é atualizado)")
    parser.add_argument("--poll-ms", type=int, default=env_int("RADIO_WORKER_POLL_MS", 15000))
    parser.add_argument("--batch-size", type=int, default=env_int("RADIO_WORKER_BATCH_SIZE", 20))
    parser.add_argument("--lease-seconds", type=int, default=env_int("RADIO_WORKER_LEASE_SECONDS", 120))
    parser.add_argument("--max-attempts", type=int, default=env_int("RADIO_WORKER_MAX_ATTEMPTS", 5))
    parser.add_argument("--log-level", default=os.getenv("RADIO_WORKER_LOG_LEVEL", "INFO"))
    args = parser.parse_args()
    logging.basicConfig(
        level=getattr(logging, str(args.log_level).upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    signal.signal(signal.SIGTERM, stop_handler)
    signal.signal(signal.SIGINT, stop_handler)

    batch_size = max(1, min(100, args.batch_size))
    lease_seconds = max(30, min(3600, args.lease_seconds))
    max_attempts = max(1, min(20, args.max_attempts))
    set_heartbeat(
        "dry_run" if args.dry_run else "running",
        reset_started_at=True,
        dryRun=args.dry_run,
        batchSize=batch_size,
        leaseSeconds=lease_seconds,
        maxAttempts=max_attempts,
    )
    try:
        while not STOP:
            try:
                handled = process_once(
                    dry_run=args.dry_run,
                    batch_size=batch_size,
                    lease_seconds=lease_seconds,
                    max_attempts=max_attempts,
                )
                LOGGER.info("rodada concluída: %s job(s)", handled)
            except Exception:
                LOGGER.exception("falha na rodada do worker")
                set_heartbeat("error", dryRun=args.dry_run, error="round_failed")
                if args.once:
                    raise
            if args.once:
                break
            # Espera em pequenos blocos para responder rápido ao SIGTERM.
            remaining = max(0.25, max(1, args.poll_ms) / 1000)
            while remaining > 0 and not STOP:
                step = min(remaining, 1.0)
                time.sleep(step)
                remaining -= step
    finally:
        set_heartbeat("stopped", dryRun=args.dry_run)


if __name__ == "__main__":
    main()
