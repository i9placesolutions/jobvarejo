-- Rádio Indoor (isolado do editor de artes)
--
-- A aplicação usa autenticação própria (JWT + public.profiles), por isso as
-- APIs sempre filtram por user_id. As tabelas ficam sem RLS para manter o
-- mesmo comportamento do restante do JobVarejo em conexões PostgreSQL nativas.
-- Esta migração é aditiva e pode ser executada mais de uma vez.

CREATE TABLE IF NOT EXISTS public.radio_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE TABLE IF NOT EXISTS public.radio_catalog_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  station_id uuid REFERENCES public.radio_stations(id) ON DELETE SET NULL,
  title text NOT NULL,
  artist text NOT NULL DEFAULT 'Artista desconhecido',
  album text,
  release_year integer,
  release_date date,
  genre text NOT NULL DEFAULT 'Outros',
  subgenres text[] NOT NULL DEFAULT '{}',
  language text DEFAULT 'pt-BR',
  duration_ms integer,
  source_url text,
  source_provider text,
  source_id text,
  storage_key text,
  thumbnail_key text,
  thumbnail_source_url text,
  audio_format text,
  audio_codec text,
  rights_status text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'archived', 'blocked')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_provider, source_id)
);

CREATE TABLE IF NOT EXISTS public.radio_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  station_id uuid REFERENCES public.radio_stations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'custom' CHECK (kind IN ('system', 'custom', 'year', 'genre', 'artist', 'special')),
  cover_key text,
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.radio_playlist_items (
  playlist_id uuid NOT NULL REFERENCES public.radio_playlists(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.radio_catalog_tracks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  weight numeric(8,3) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS public.radio_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.radio_stations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.radio_program_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.radio_programs(id) ON DELETE CASCADE,
  block_type text NOT NULL CHECK (block_type IN ('music', 'playlist', 'audio_pack', 'jingle', 'commercial', 'request', 'clock')),
  label text NOT NULL,
  playlist_id uuid REFERENCES public.radio_playlists(id) ON DELETE SET NULL,
  duration_seconds integer,
  target_count integer,
  position integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.radio_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.radio_stations(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.radio_programs(id) ON DELETE CASCADE,
  days_of_week smallint[] NOT NULL DEFAULT '{1,2,3,4,5}'::smallint[],
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  starts_on date,
  ends_on date,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.radio_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  station_id uuid REFERENCES public.radio_stations(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('jingle', 'off', 'voice', 'music')),
  title text NOT NULL,
  brief text NOT NULL,
  lyrics text,
  style text,
  voice_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'ready', 'failed', 'cancelled')),
  provider text,
  provider_task_id text,
  provider_conversion_id text,
  result_storage_key text,
  result_source_url text,
  result_format text,
  result_duration_ms integer,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_task_id)
);

CREATE TABLE IF NOT EXISTS public.radio_playback_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  station_id uuid REFERENCES public.radio_stations(id) ON DELETE SET NULL,
  track_id uuid REFERENCES public.radio_catalog_tracks(id) ON DELETE SET NULL,
  playlist_id uuid REFERENCES public.radio_playlists(id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.radio_programs(id) ON DELETE SET NULL,
  played_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  source text NOT NULL DEFAULT 'internal-player',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.radio_schedule_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.radio_stations(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.radio_schedules(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  kind text NOT NULL DEFAULT 'schedule_tick',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.radio_worker_heartbeats (
  worker_id text PRIMARY KEY,
  host text NOT NULL,
  pid integer,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'error', 'dry_run')),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A conta continua sendo a proprietária dos dados de rádio, enquanto esta
-- tabela controla quem pode operar cada loja. Os níveis são específicos da
-- Rádio Indoor e não alteram profiles.role do restante do JobVarejo.
CREATE TABLE IF NOT EXISTS public.radio_station_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.radio_stations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'operator'
    CHECK (access_level IN ('owner', 'manager', 'editor', 'operator', 'player')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'suspended')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, user_id)
);

-- Um usuário pode abrir mais de um player simultâneo (por exemplo, uma
-- sessão/kiosque em cada filial). O token é armazenado somente como hash.
CREATE TABLE IF NOT EXISTS public.radio_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.radio_stations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_hint text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'revoked')),
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS radio_stations_user_idx ON public.radio_stations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS radio_tracks_catalog_idx ON public.radio_catalog_tracks(user_id, status, genre, release_year, artist);
CREATE INDEX IF NOT EXISTS radio_tracks_station_idx ON public.radio_catalog_tracks(station_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS radio_playlist_items_position_idx ON public.radio_playlist_items(playlist_id, position, track_id);
CREATE INDEX IF NOT EXISTS radio_programs_station_idx ON public.radio_programs(station_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS radio_blocks_program_idx ON public.radio_program_blocks(program_id, position);
CREATE INDEX IF NOT EXISTS radio_schedules_active_idx ON public.radio_schedules(station_id, enabled, priority, start_time);
CREATE INDEX IF NOT EXISTS radio_requests_user_idx ON public.radio_requests(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS radio_jobs_due_idx ON public.radio_schedule_jobs(status, due_at);
CREATE INDEX IF NOT EXISTS radio_worker_heartbeats_seen_idx ON public.radio_worker_heartbeats(status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS radio_station_members_user_idx ON public.radio_station_members(user_id, status, station_id);
CREATE INDEX IF NOT EXISTS radio_station_members_station_idx ON public.radio_station_members(station_id, status, access_level);
CREATE INDEX IF NOT EXISTS radio_players_station_idx ON public.radio_players(station_id, status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS radio_players_user_idx ON public.radio_players(user_id, status, station_id);

CREATE OR REPLACE FUNCTION public.update_radio_indoor_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'radio_stations', 'radio_catalog_tracks', 'radio_playlists',
    'radio_programs', 'radio_program_blocks', 'radio_schedules',
    'radio_requests', 'radio_schedule_jobs', 'radio_worker_heartbeats',
    'radio_station_members', 'radio_players'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_updated_at', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_radio_indoor_updated_at()',
      table_name || '_updated_at', table_name
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.radio_stations IS 'Estações privadas do módulo Rádio Indoor do JobVarejo';
COMMENT ON TABLE public.radio_catalog_tracks IS 'Catálogo de áudio com metadados e referências privadas do Wasabi';
COMMENT ON TABLE public.radio_schedule_jobs IS 'Fila leve de ticks para o worker Python da Rádio Indoor';
COMMENT ON TABLE public.radio_worker_heartbeats IS 'Heartbeat dos workers Python que atendem todas as lojas da Rádio Indoor';
COMMENT ON TABLE public.radio_station_members IS 'Usuários e níveis de acesso por loja da Rádio Indoor';
COMMENT ON TABLE public.radio_players IS 'Players/kiosques simultâneos vinculados a uma loja da Rádio Indoor';

-- As estações existentes continuam acessíveis ao proprietário como owner.
INSERT INTO public.radio_station_members (station_id, user_id, access_level, status, created_by)
SELECT id, user_id, 'owner', 'active', user_id
  FROM public.radio_stations
ON CONFLICT (station_id, user_id) DO UPDATE
  SET access_level = 'owner', status = 'active', updated_at = now();
