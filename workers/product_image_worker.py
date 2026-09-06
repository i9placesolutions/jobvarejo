#!/usr/bin/env python3
"""Resolve imagens de produtos com Wasabi primeiro e Google CSE como fallback.

O worker recebe uma lista JSON, JSONL ou CSV/TSV. Cada produto e processado
isoladamente: uma falha nao interrompe o restante do lote. O resultado e um
manifesto com a imagem escolhida, score, key do Wasabi e erro (quando houver).

O worker preserva referencias ja informadas, consulta o cache/registry e
indexa as imagens existentes em `imagens/` e `uploads/`. Somente quando nao
ha uma correspondencia interna ele consulta o Google CSE, valida os resultados,
baixa uma imagem aprovada, converte-a para WebP e a salva no Wasabi.

Uso rapido:

    python3 workers/product_image_worker.py \
      --input produtos.json \
      --output product-image-manifest.json \
      --persist-db

Dependencias opcionais sao importadas sob demanda. Assim, --dry-run e os
helpers de normalizacao podem ser usados sem boto3 ou psycopg instalados.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import logging
import os
import re
import socket
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from ipaddress import ip_address
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


LOGGER = logging.getLogger("product-image-worker")

MAX_PRODUCT_NAME = 180
MAX_STORAGE_KEY_LENGTH = 1024
MAX_EXTERNAL_URL_LENGTH = 2048
MAX_EXTERNAL_IMAGE_BYTES = 12 * 1024 * 1024
GOOGLE_CSE_TIMEOUT_SECONDS = 12
EXTERNAL_IMAGE_TIMEOUT_SECONDS = 15

UNIT_MAP = {
    "mililitros": "ml",
    "mililitro": "ml",
    "mls": "ml",
    "gramas": "g",
    "grama": "g",
    "gram": "g",
    "gr": "g",
    "grs": "g",
    "gs": "g",
    "quilos": "kg",
    "quilo": "kg",
    "quilogramas": "kg",
    "quilograma": "kg",
    "kgs": "kg",
    "unidades": "un",
    "unidade": "un",
    "und": "un",
    "unds": "un",
    "uns": "un",
    "litro": "l",
    "litros": "l",
    "lt": "l",
    "lts": "l",
    "pacote": "pct",
    "pacotes": "pct",
    "pcts": "pct",
    "caixa": "cx",
    "caixas": "cx",
    "fardo": "fd",
    "fardos": "fd",
}

TOKEN_ALIASES = {
    "refri": "refrigerante",
    "refrigerantes": "refrigerante",
    "coca": "cocacola",
    "cocacolaoriginal": "cocacola",
    "coca-cola": "cocacola",
    "coca cola": "cocacola",
    "tradicional": "original",
    "classico": "original",
    "classic": "original",
    "regular": "original",
    "zeroacucar": "zero",
    "semacucar": "zero",
}

STOP_WORDS = {
    "o",
    "a",
    "os",
    "as",
    "de",
    "do",
    "da",
    "dos",
    "das",
    "com",
    "em",
    "e",
    "para",
    "por",
    "no",
    "na",
}

QUERY_NOISE = {
    "produto",
    "produtos",
    "embalagem",
    "embalagens",
    "foto",
    "frente",
    "supermercado",
    "original",
    "imagem",
    "imagens",
    "packshot",
    "real",
    "manual",
    "smart",
    "src",
    "ext",
    "bg",
    "cache",
    "processed",
}

BAD_EXTERNAL_HINTS_RE = re.compile(
    r"(logo|vetor|vector|icone|icon|clipart|mockup|banner|wallpaper|"
    r"papel parede|sticker|figurinha|svg|eps|cdr|psd|adesivo)",
    re.IGNORECASE,
)
BAD_EXTERNAL_DOMAIN_RE = re.compile(
    r"(pinterest|pinimg|freepik|wikimedia|wikipedia|shutterstock|"
    r"depositphotos|istockphoto|vectorstock)",
    re.IGNORECASE,
)

class WorkerError(RuntimeError):
    """Erro esperado de uma etapa do worker."""


class ConfigurationError(WorkerError):
    """Configuracao ausente ou dependencia obrigatoria nao instalada."""


class StorageError(WorkerError):
    """Falha de leitura/escrita no Wasabi."""


def text(value: Any) -> str:
    return str(value or "").strip()


def assert_safe_storage_key(raw_key: Any) -> str:
    """Impede keys absolutas, traversal e caracteres de controle."""

    key = text(raw_key)
    if not key or len(key) > MAX_STORAGE_KEY_LENGTH:
        raise WorkerError("key do Wasabi invalida")
    if key.startswith("/") or "\\" in key or "\x00" in key:
        raise WorkerError("key do Wasabi invalida")
    if any(ord(character) < 32 or ord(character) == 127 for character in key):
        raise WorkerError("key do Wasabi invalida")
    if any(part in {"", ".", ".."} for part in key.split("/")):
        raise WorkerError("key do Wasabi invalida")
    return key


def _is_private_or_reserved_host(hostname: str) -> bool:
    host = text(hostname).lower().rstrip(".")
    if host in {"localhost", "localhost.localdomain"} or host.endswith((".localhost", ".local", ".internal")):
        return True
    try:
        address = ip_address(host)
    except ValueError:
        return False
    return bool(
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def assert_safe_external_http_url(raw_url: Any) -> str:
    """Aceita somente URLs HTTP(S) públicas para o fallback externo."""

    value = text(raw_url)
    if not value or len(value) > MAX_EXTERNAL_URL_LENGTH:
        raise WorkerError("URL externa invalida")
    try:
        parsed = urllib.parse.urlparse(value)
        hostname = parsed.hostname or ""
        port = parsed.port
    except ValueError as exc:
        raise WorkerError("URL externa invalida") from exc
    if parsed.scheme.lower() not in {"http", "https"} or not hostname:
        raise WorkerError("URL externa invalida")
    if parsed.username or parsed.password or _is_private_or_reserved_host(hostname):
        raise WorkerError("URL externa bloqueada")
    if port is not None and not 1 <= port <= 65535:
        raise WorkerError("URL externa invalida")
    return parsed._replace(fragment="").geturl()


def normalize_text(value: Any) -> str:
    raw = unicodedata.normalize("NFD", text(value))
    raw = "".join(ch for ch in raw if unicodedata.category(ch) != "Mn")
    raw = raw.lower().replace("\u00a0", " ")
    raw = re.sub(r"(\d)[,](\d)", r"\1.\2", raw)
    raw = re.sub(r"[^a-z0-9.\s]", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def _normalize_weight_token(value: str) -> str:
    compact = normalize_text(value).replace(" ", "").replace(",", ".")
    compact = re.sub(r"grs?\b", "g", compact)
    compact = re.sub(r"kgs?\b", "kg", compact)
    compact = re.sub(r"mls?\b", "ml", compact)
    compact = re.sub(r"lts?\b", "l", compact)
    return compact


def normalize_search_term(value: Any) -> str:
    """Replica a normalizacao usada no matching TypeScript do projeto."""

    raw = normalize_text(value)
    raw = re.sub(r"\bcoca\s*-?\s*cola\b", " cocacola ", raw)
    raw = re.sub(r"\b(zero\s+acucar|sem\s+acucar|sugar\s*free)\b", " zero ", raw)
    raw = re.sub(r"\b(tradicional|classico|classic|regular)\b", " original ", raw)
    tokens: List[str] = []
    for token in raw.split():
        if token in STOP_WORDS:
            continue
        mapped = UNIT_MAP.get(token, token)
        mapped = TOKEN_ALIASES.get(mapped, mapped)
        if mapped:
            tokens.append(mapped)
    if "cocacola" in tokens:
        tokens = [token for token in tokens if token not in {"coca", "cola"}]
    return " ".join(sorted(set(tokens)))


def _query_token_set(value: str) -> List[str]:
    return [
        token
        for token in normalize_search_term(value).split()
        if token not in QUERY_NOISE and len(token) >= 2
    ]


def _field(record: Mapping[str, Any], *names: str) -> str:
    for name in names:
        if name in record and text(record.get(name)):
            return text(record.get(name))
    normalized_keys = {
        normalize_text(key).replace(" ", ""): key for key in record.keys()
    }
    for name in names:
        key = normalized_keys.get(normalize_text(name).replace(" ", ""))
        if key is not None and text(record.get(key)):
            return text(record.get(key))
    return ""


def normalize_product_record(record: Mapping[str, Any], index: int) -> Dict[str, Any]:
    """Aceita tanto o payload de /api/parse-products quanto CSVs brasileiros."""

    nested = record.get("product") if isinstance(record.get("product"), Mapping) else {}
    merged: Dict[str, Any] = dict(nested)
    merged.update(record)
    return {
        "id": _field(merged, "id", "productId", "codigo", "productCode") or str(index),
        "name": _field(merged, "name", "nome", "produto", "product", "descricao", "descrição"),
        "productCode": _field(merged, "productCode", "product_code", "codigo", "código"),
        "brand": _field(merged, "brand", "marca"),
        "weight": _field(merged, "weight", "peso", "gramatura", "tamanho", "volume"),
        "flavor": _field(merged, "flavor", "sabor", "variante", "variant"),
        "price": _field(merged, "price", "preco", "preço", "valor"),
        "imageUrl": _field(merged, "imageUrl", "image_url", "image", "imagem", "custom_image"),
        "imageKey": _field(merged, "imageKey", "image_key", "image_wasabi_key", "s3Key", "s3_key"),
        "raw": dict(record),
    }


def _detect_delimiter(sample: str) -> str:
    try:
        return csv.Sniffer().sniff(sample, delimiters=";,\t,").delimiter
    except csv.Error:
        return ";" if ";" in sample else ","


def load_products(path: str) -> List[Dict[str, Any]]:
    """Carrega JSON array, {products: [...]}, JSONL, CSV ou TSV."""

    if path == "-":
        raw = sys.stdin.read()
        suffix = ".json"
    else:
        input_path = Path(path)
        raw = input_path.read_text(encoding="utf-8-sig")
        suffix = input_path.suffix.lower()

    if suffix in {".json", ".jsonl"} or path == "-":
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, Mapping):
                parsed = parsed.get("products") or parsed.get("items") or parsed.get("data")
            if not isinstance(parsed, list):
                raise WorkerError("JSON deve ser uma lista ou conter a chave products/items")
            return [normalize_product_record(item, idx + 1) for idx, item in enumerate(parsed) if isinstance(item, Mapping)]
        except json.JSONDecodeError:
            if suffix != ".jsonl":
                raise WorkerError("Arquivo nao e um JSON valido")
            products: List[Dict[str, Any]] = []
            for line_number, line in enumerate(raw.splitlines(), 1):
                if not line.strip():
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise WorkerError("JSONL invalido na linha %s: %s" % (line_number, exc))
                if isinstance(item, Mapping):
                    products.append(normalize_product_record(item, len(products) + 1))
            return products

    delimiter = "\t" if suffix == ".tsv" else _detect_delimiter(raw[:4096])
    rows = csv.DictReader(io.StringIO(raw), delimiter=delimiter)
    return [normalize_product_record(row, idx + 1) for idx, row in enumerate(rows)]


def product_search_text(product: Mapping[str, Any]) -> str:
    parts = [
        text(product.get("name")),
        text(product.get("brand")),
        text(product.get("flavor")),
        text(product.get("weight")),
    ]
    return " ".join(part for part in parts if part).strip()


def _external_domain(value: Any) -> str:
    raw = text(value)
    if not raw:
        return ""
    try:
        parsed = urllib.parse.urlparse(raw if "://" in raw else "https://" + raw)
        return text(parsed.hostname).lower().rstrip(".")
    except ValueError:
        return ""


def _positive_int(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 0
    return parsed if parsed > 0 else 0


def _read_bounded_response(response: Any, max_bytes: int) -> bytes:
    content_length = text(getattr(response, "headers", {}).get("Content-Length", ""))
    if content_length.isdigit() and int(content_length) > max_bytes:
        raise WorkerError("resposta externa excede o limite de tamanho")
    chunks: List[bytes] = []
    total = 0
    while True:
        chunk = response.read(min(1024 * 1024, max_bytes - total + 1))
        if not chunk:
            break
        data = bytes(chunk)
        total += len(data)
        if total > max_bytes:
            raise WorkerError("resposta externa excede o limite de tamanho")
        chunks.append(data)
    return b"".join(chunks)


def _google_query(product: Mapping[str, Any]) -> str:
    query = product_search_text(product)
    if not query:
        return ""
    return (query + " embalagem produto").strip()[:240]


def search_google_cse_candidates(
    product: Mapping[str, Any],
    api_key: str,
    cx: str,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    """Consulta o Google CSE sem expor a chave nem baixar imagens ainda."""

    api_key = text(api_key)
    cx = text(cx)
    query = _google_query(product)
    if not api_key or not cx or not query:
        return []

    limit = max(1, min(10, int(max_results or 10)))
    request_url = "https://www.googleapis.com/customsearch/v1?" + urllib.parse.urlencode(
        {
            "key": api_key,
            "cx": cx,
            "q": query,
            "searchType": "image",
            "num": limit,
            "gl": "br",
            "hl": "pt-BR",
            "safe": "off",
        }
    )
    request = urllib.request.Request(
        request_url,
        headers={"Accept": "application/json", "User-Agent": "JobVarejoProductImageWorker/1.0"},
        method="GET",
    )
    try:
        response = urllib.request.urlopen(request, timeout=GOOGLE_CSE_TIMEOUT_SECONDS)
        try:
            status = int(getattr(response, "status", 200) or 200)
            if status >= 400:
                LOGGER.warning("Google CSE retornou HTTP %s", status)
                return []
            payload = json.loads(_read_bounded_response(response, 2 * 1024 * 1024).decode("utf-8"))
        finally:
            close = getattr(response, "close", None)
            if callable(close):
                close()
    except urllib.error.HTTPError as exc:
        LOGGER.warning("Google CSE retornou HTTP %s", getattr(exc, "code", "unknown"))
        return []
    except (urllib.error.URLError, TimeoutError, OSError, WorkerError, json.JSONDecodeError) as exc:
        LOGGER.warning("Google CSE indisponivel: %s", type(exc).__name__)
        return []

    items = payload.get("items", []) if isinstance(payload, Mapping) else []
    candidates: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, Mapping):
            continue
        try:
            safe_url = assert_safe_external_http_url(item.get("link"))
        except WorkerError:
            continue
        if safe_url in seen:
            continue
        seen.add(safe_url)
        image = item.get("image") if isinstance(item.get("image"), Mapping) else {}
        width = _positive_int(image.get("width"))
        height = _positive_int(image.get("height"))
        candidates.append(
            {
                "url": safe_url,
                "title": text(item.get("title")),
                "source": text(image.get("contextLink") or item.get("displayLink")),
                "imageWidth": width or None,
                "imageHeight": height or None,
            }
        )
    return candidates


def rank_google_image_candidates(
    candidates: Sequence[Mapping[str, Any]],
    product: Mapping[str, Any],
    max_candidates: int = 6,
) -> List[Dict[str, Any]]:
    """Classifica resultados antes de permitir qualquer download externo."""

    query_tokens: List[str] = []
    for value in (
        product_search_text(product),
        text(product.get("brand")),
        text(product.get("flavor")),
        text(product.get("weight")),
        text(product.get("productCode")),
    ):
        for token in _query_token_set(value):
            if token not in query_tokens:
                query_tokens.append(token)
    if not query_tokens:
        return []

    ranked: List[Dict[str, Any]] = []
    for candidate in candidates:
        try:
            safe_url = assert_safe_external_http_url(candidate.get("url"))
        except WorkerError:
            continue
        title = text(candidate.get("title"))
        source = text(candidate.get("source"))
        domain = _external_domain(source) or _external_domain(safe_url)
        haystack = " ".join((title, source, safe_url, domain))
        if not domain or BAD_EXTERNAL_HINTS_RE.search(haystack) or BAD_EXTERNAL_DOMAIN_RE.search(domain):
            continue

        title_text = normalize_text(title)
        source_text = normalize_text(source)
        url_text = normalize_text(safe_url)
        domain_text = normalize_text(domain)
        score = 0.0
        hits = 0
        for token in query_tokens:
            if token in title_text:
                score += 3.4
                hits += 1
            elif token in source_text:
                score += 2.1
                hits += 1
            elif token in url_text or token in domain_text:
                score += 1.1
                hits += 1

        if re.search(r"(produto|embalagem|pack|lata|garrafa|caixa|frasco|sache|display)", haystack, re.IGNORECASE):
            score += 1.8
        if re.search(r"\.(svg|eps|pdf)(?:$|[?#])", safe_url, re.IGNORECASE):
            score -= 10
        if re.search(r"(thumb|thumbnail|sprite|avatar|favicon|icon)", safe_url, re.IGNORECASE):
            score -= 4

        try:
            width = int(candidate.get("imageWidth") or 0)
            height = int(candidate.get("imageHeight") or 0)
        except (TypeError, ValueError):
            width = height = 0
        if width > 0 and height > 0:
            min_side = min(width, height)
            aspect = max(width, height) / max(1, min_side)
            if min_side >= 280:
                score += 1.8
            if min_side < 120:
                score -= 4
            if aspect > 4:
                score -= 3

        coverage = hits / len(query_tokens)
        if coverage >= 0.8:
            score += 2.4
        elif coverage >= 0.5:
            score += 1.1
        elif coverage < 0.25:
            score -= 2.2
        if score <= 0:
            continue

        confidence = min(0.98, max(0.42, 0.42 + (max(0, score) / 20) + coverage * 0.18))
        ranked.append(
            {
                "url": safe_url,
                "title": title,
                "source": source,
                "domain": domain,
                "imageWidth": width or None,
                "imageHeight": height or None,
                "score": round(score, 3),
                "confidence": round(confidence, 3),
                "reason": "%s/%s termos encontrados; resultado filtrado por produto/embalagem"
                % (hits, len(query_tokens)),
            }
        )

    ranked.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
    limit = max(1, min(6, int(max_candidates or 6)))
    for index, candidate in enumerate(ranked[:limit]):
        candidate["recommended"] = index == 0
    return ranked[:limit]


def download_and_convert_external_image(url: str) -> bytes:
    """Baixa uma imagem candidata com limites e grava um WebP normalizado."""

    safe_url = assert_safe_external_http_url(url)
    request = urllib.request.Request(
        safe_url,
        headers={"Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", "User-Agent": "JobVarejoProductImageWorker/1.0"},
        method="GET",
    )
    response = urllib.request.urlopen(request, timeout=EXTERNAL_IMAGE_TIMEOUT_SECONDS)
    try:
        raw = _read_bounded_response(response, MAX_EXTERNAL_IMAGE_BYTES)
    finally:
        close = getattr(response, "close", None)
        if callable(close):
            close()
    if not raw:
        raise WorkerError("imagem externa vazia")

    try:
        from PIL import Image  # type: ignore
    except ImportError as exc:
        raise ConfigurationError("Pillow nao esta instalado; use pip install -r workers/requirements.txt") from exc

    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            if image.width <= 0 or image.height <= 0:
                raise WorkerError("imagem externa sem dimensoes validas")
            resampling = getattr(Image, "Resampling", Image).LANCZOS
            image.thumbnail((800, 800), resampling)
            normalized = image.convert("RGBA")
            output = io.BytesIO()
            normalized.save(output, format="WEBP", quality=85, method=6)
            payload = output.getvalue()
    except WorkerError:
        raise
    except Exception as exc:
        raise WorkerError("imagem externa nao pode ser validada") from exc
    if not payload:
        raise WorkerError("imagem externa nao pode ser convertida")
    return payload


def external_image_storage_key(url: str) -> str:
    safe_url = assert_safe_external_http_url(url)
    digest = hashlib.sha256(safe_url.encode("utf-8")).hexdigest()[:32]
    return "imagens/google-cse-%s.webp" % digest


def product_identity_key(product: Mapping[str, Any], normalized_term: str) -> str:
    code = re.sub(r"[^a-zA-Z0-9]", "", text(product.get("productCode"))).lower()
    if code:
        return "code:" + code
    parts = [
        normalize_text(normalized_term),
        normalize_text(product.get("brand")),
        normalize_text(product.get("flavor")),
        normalize_text(product.get("weight")),
    ]
    raw = "|".join(part for part in parts if part)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return "meta:" + digest



class WasabiStore:
    def __init__(self, endpoint: str, bucket: str, region: str, access_key: str, secret_key: str) -> None:
        try:
            import boto3  # type: ignore
            from botocore.config import Config  # type: ignore
        except ImportError as exc:
            raise ConfigurationError("boto3 nao esta instalado; use pip install -r workers/requirements.txt") from exc
        self.endpoint = text(endpoint).replace("https://", "").replace("http://", "").rstrip("/")
        self.bucket = text(bucket)
        self.client = boto3.client(
            "s3",
            endpoint_url="https://" + self.endpoint,
            region_name=text(region) or "us-east-1",
            aws_access_key_id=text(access_key),
            aws_secret_access_key=text(secret_key),
            config=Config(
                s3={"addressing_style": "path"},
                retries={"max_attempts": 2, "mode": "standard"},
                connect_timeout=15,
                read_timeout=120,
            ),
        )

    def public_url(self, key: str) -> str:
        safe_key = assert_safe_storage_key(key)
        return "https://%s/%s/%s" % (
            self.endpoint,
            urllib.parse.quote(self.bucket, safe=""),
            urllib.parse.quote(safe_key, safe="/"),
        )

    def exists(self, key: str) -> bool:
        safe_key = assert_safe_storage_key(key)
        try:
            self.client.head_object(Bucket=self.bucket, Key=safe_key)
            return True
        except Exception as exc:
            response = getattr(exc, "response", {})
            status = response.get("ResponseMetadata", {}).get("HTTPStatusCode") if isinstance(response, Mapping) else None
            code = response.get("Error", {}).get("Code") if isinstance(response, Mapping) else None
            if status == 404 or code in {"404", "NoSuchKey", "NotFound"}:
                return False
            # A missing object and a transient/credential error must be
            # distinguishable in the log; the caller will mark the item failed.
            raise StorageError("falha ao verificar key no Wasabi: %s" % exc)

    def put_webp(self, key: str, body: bytes) -> None:
        safe_key = assert_safe_storage_key(key)
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=safe_key,
                Body=body,
                ContentType="image/webp",
                ACL="public-read",
                CacheControl="public,max-age=31536000,immutable",
            )
        except Exception as exc:
            raise StorageError("falha ao enviar imagem para o Wasabi: %s" % exc)

    def list_image_keys(self) -> List[str]:
        """Lista imagens internas uma vez para resolver o produto no Wasabi."""

        keys: List[str] = []
        try:
            paginator = self.client.get_paginator("list_objects_v2")
            for prefix in ("imagens/", "uploads/"):
                for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                    contents = page.get("Contents", []) if isinstance(page, Mapping) else []
                    for item in contents:
                        key = text(item.get("Key")) if isinstance(item, Mapping) else ""
                        if not key or not re.search(r"\.(?:png|jpe?g|webp|gif|svg|avif)$", key, re.IGNORECASE):
                            continue
                        keys.append(assert_safe_storage_key(key))
        except Exception as exc:
            raise StorageError("falha ao listar imagens do Wasabi: %s" % exc)
        return sorted(set(keys))


def storage_key_display_name(key: str) -> str:
    """Extrai o nome humano de keys manuais/smart sem usar hashes como tokens."""

    raw = urllib.parse.unquote(text(key).split("/")[-1])
    raw = re.sub(r"\.(?:png|jpe?g|webp|gif|avif)$", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"^(?:manual|smart)-(?:src|ext)-", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"^(?:manual|smart)-", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"(?:^|[-_])[0-9a-f]{10,}(?:[-_]|$)", " ", raw, flags=re.IGNORECASE)
    raw = re.sub(r"(?:^|[-_])(?:bg|original|v\d+)(?:[-_]|$)", " ", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\b(?:bg|original|v\d+)\b", " ", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\b[0-9a-f]{10,}\b", " ", raw, flags=re.IGNORECASE)
    raw = re.sub(r"[-_]+", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


class StorageImageIndex:
    """Indice leve de nomes das imagens internas listadas no Wasabi."""

    def __init__(self, keys: Iterable[str]) -> None:
        self.entries: List[Tuple[str, str, List[str]]] = []
        for raw_key in keys:
            key = text(raw_key)
            display_name = storage_key_display_name(key)
            tokens = _query_token_set(display_name)
            if key and tokens:
                self.entries.append((key, display_name, tokens))

    def find(self, product: Mapping[str, Any]) -> Optional[Tuple[str, float]]:
        query_tokens = _query_token_set(product_search_text(product))
        name_tokens = set(_query_token_set(text(product.get("name"))))
        weight = _normalize_weight_token(text(product.get("weight")))
        if not query_tokens:
            return None
        best: Optional[Tuple[str, float]] = None
        for key, _display_name, target_tokens in self.entries:
            target_set = set(target_tokens)
            name_hits = len(name_tokens.intersection(target_set))
            if name_tokens and name_hits == 0:
                continue
            query_hits = len(set(query_tokens).intersection(target_set))
            if query_hits == 0:
                continue
            score = float(name_hits * 3.0 + query_hits * 1.5)
            if name_tokens and name_hits == len(name_tokens):
                score += 3.0
            if weight:
                score += 2.0 if weight in target_set else -1.5
            if best is None or score > best[1]:
                best = (key, round(score, 3))
        # A match de uma palavra generica nao deve preencher automaticamente.
        return best if best and best[1] >= 5.0 else None


class DatabaseStore:
    """Persistencia opcional no cache/registry ja usados pelo editor."""

    def __init__(self, dsn: str, user_id: str = "", validated_by: str = "worker:wasabi-storage") -> None:
        try:
            import psycopg  # type: ignore
        except ImportError as exc:
            raise ConfigurationError("psycopg nao esta instalado; use pip install -r workers/requirements.txt") from exc
        self.user_id = text(user_id) or None
        self.validated_by = text(validated_by) or "worker:wasabi-storage"
        try:
            self.connection = psycopg.connect(dsn, autocommit=True)
        except Exception as exc:
            raise ConfigurationError("nao foi possivel conectar ao PostgreSQL: %s" % exc) from exc
        self.cache_available = True
        self._ensure_registry_schema()

    def _ensure_registry_schema(self) -> None:
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    """
                    create table if not exists public.product_image_registry (
                      id bigserial primary key,
                      product_code text null,
                      product_identity_key text not null,
                      canonical_name text null,
                      brand text null,
                      flavor text null,
                      weight text null,
                      s3_key text null,
                      source text null,
                      validation_level text null,
                      validated_at timestamptz null,
                      validated_by text null,
                      status text not null default 'review_pending'
                        check (status in ('approved', 'review_pending', 'rejected')),
                      reason text null,
                      created_at timestamptz not null default timezone('utc', now()),
                      updated_at timestamptz not null default timezone('utc', now())
                    )
                    """
                )
                cursor.execute(
                    "create unique index if not exists product_image_registry_identity_key_uidx "
                    "on public.product_image_registry (product_identity_key)"
                )
        except Exception as exc:
            LOGGER.warning("Nao foi possivel garantir product_image_registry: %s", exc)

    def lookup_registry(self, identity_key: str) -> Optional[Dict[str, Any]]:
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    """
                    select s3_key, status, source
                      from public.product_image_registry
                     where product_identity_key = %s
                       and status = 'approved'
                       and s3_key is not null
                     order by validated_at desc nulls last, id desc
                     limit 1
                    """,
                    (identity_key,),
                )
                row = cursor.fetchone()
            if not row:
                return None
            return {"s3_key": row[0], "status": row[1], "source": row[2]}
        except Exception as exc:
            LOGGER.warning("Consulta do registry falhou: %s", exc)
            return None

    def lookup_cache(self, terms: Sequence[str]) -> Optional[Dict[str, Any]]:
        if not self.cache_available:
            return None
        for term_value in terms:
            try:
                with self.connection.cursor() as cursor:
                    cursor.execute(
                        """
                        select image_url, s3_key, source
                          from public.product_image_cache
                         where search_term = %s
                         order by usage_count desc nulls last
                         limit 1
                        """,
                        (term_value,),
                    )
                    row = cursor.fetchone()
                if row:
                    return {"image_url": row[0], "s3_key": row[1], "source": row[2]}
            except Exception as exc:
                self.cache_available = False
                LOGGER.warning("Cache product_image_cache indisponivel; continuando sem DB: %s", exc)
                return None
        return None

    def save_cache(
        self,
        product: Mapping[str, Any],
        normalized_term: str,
        image_url: str,
        key: str,
        source: str = "wasabi-storage",
    ) -> None:
        if not self.cache_available:
            return
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    """
                    insert into public.product_image_cache
                      (search_term, product_name, brand, flavor, weight,
                       image_url, s3_key, source, user_id, usage_count)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                    on conflict (search_term) do update set
                      product_name = excluded.product_name,
                      brand = excluded.brand,
                      flavor = excluded.flavor,
                      weight = excluded.weight,
                      image_url = excluded.image_url,
                      s3_key = excluded.s3_key,
                      source = excluded.source,
                      user_id = excluded.user_id,
                      usage_count = excluded.usage_count,
                      updated_at = timezone('utc', now())
                    """,
                    (
                        normalized_term,
                        text(product.get("name")) or normalized_term,
                        text(product.get("brand")) or None,
                        text(product.get("flavor")) or None,
                        text(product.get("weight")) or None,
                        image_url,
                        key,
                        text(source) or "wasabi-storage",
                        self.user_id,
                    ),
                )
        except Exception as exc:
            # A schema antiga/ausente nao deve apagar o upload ja concluido.
            self.cache_available = False
            LOGGER.warning("Imagem salva no Wasabi, mas cache nao foi atualizado: %s", exc)

    def save_registry(
        self,
        product: Mapping[str, Any],
        identity_key: str,
        normalized_term: str,
        key: str,
        confidence: float,
        source: str = "wasabi-storage",
        validation_level: str = "wasabi-name-match",
        status: str = "review_pending",
        reason: str = "",
    ) -> None:
        registry_status = status if status in {"approved", "review_pending", "rejected"} else "review_pending"
        registry_reason = text(reason) or "Imagem automatica; confidence=%.3f; revisar antes de exportar" % confidence
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    """
                    insert into public.product_image_registry
                      (product_code, product_identity_key, canonical_name, brand,
                       flavor, weight, s3_key, source, validation_level,
                       validated_at, validated_by, status, reason, updated_at)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s,
                            timezone('utc', now()), %s, %s, %s,
                            timezone('utc', now()))
                    on conflict (product_identity_key) do update set
                      product_code = excluded.product_code,
                      canonical_name = excluded.canonical_name,
                      brand = excluded.brand,
                      flavor = excluded.flavor,
                      weight = excluded.weight,
                      s3_key = excluded.s3_key,
                      source = excluded.source,
                      validation_level = excluded.validation_level,
                      validated_at = excluded.validated_at,
                      validated_by = excluded.validated_by,
                      status = excluded.status,
                      reason = excluded.reason,
                      updated_at = timezone('utc', now())
                    """,
                    (
                        re.sub(r"[^a-zA-Z0-9]", "", text(product.get("productCode"))) or None,
                        identity_key,
                        text(product.get("name")) or normalized_term,
                        text(product.get("brand")) or None,
                        text(product.get("flavor")) or None,
                        text(product.get("weight")) or None,
                        key,
                        text(source) or "wasabi-storage",
                        text(validation_level) or "wasabi-name-match",
                        self.validated_by,
                        registry_status,
                        registry_reason,
                    ),
                )
        except Exception as exc:
            LOGGER.warning("Imagem salva no Wasabi, mas registry nao foi atualizado: %s", exc)

    def close(self) -> None:
        try:
            self.connection.close()
        except Exception:
            pass


def _cache_key_from_row(row: Optional[Mapping[str, Any]]) -> str:
    if not row:
        return ""
    key = text(row.get("s3_key"))
    return key if key else ""


def _result_base(product: Mapping[str, Any], normalized_term: str) -> Dict[str, Any]:
    return {
        "id": text(product.get("id")),
        "name": text(product.get("name")),
        "brand": text(product.get("brand")) or None,
        "weight": text(product.get("weight")) or None,
        "normalizedTerm": normalized_term,
        "status": "failed",
        "imageSource": None,
        "imageUrl": None,
        "s3Key": None,
        "sourceUrl": None,
        "sourceTitle": None,
        "score": None,
        "confidence": None,
        "attempts": 0,
        "candidateCount": 0,
        "error": None,
    }


def _existing_image_result(
    product: Mapping[str, Any],
    normalized_term: str,
    s3: WasabiStore,
) -> Optional[Dict[str, Any]]:
    """Retorna um resultado de skip quando a lista ja traz uma imagem valida."""

    raw_key = text(product.get("imageKey"))
    raw_url = text(product.get("imageUrl"))
    if raw_key:
        try:
            key = assert_safe_storage_key(raw_key)
            if s3.exists(key):
                result = _result_base(product, normalized_term)
                result.update(
                    {
                        "status": "skipped-existing",
                        "imageSource": "existing",
                        "imageUrl": s3.public_url(key),
                        "s3Key": key,
                        "confidence": 1.0,
                        "error": None,
                    }
                )
                return result
            LOGGER.info("Imagem declarada nao existe no Wasabi; buscando novamente: %s", key)
        except (WorkerError, StorageError) as exc:
            LOGGER.info("Imagem declarada invalida; buscando novamente: %s", exc)

    # Um URL externo ou data URL ainda e uma imagem fornecida pelo usuario.
    # Nao substituimos esse asset silenciosamente; a opcao --force permite
    # reprocessar a linha quando isso for desejado.
    if raw_url:
        result = _result_base(product, normalized_term)
        result.update(
            {
                "status": "skipped-existing",
                "imageSource": "existing",
                "imageUrl": raw_url,
                "s3Key": raw_key or None,
                "confidence": 1.0,
                "error": None,
            }
        )
        return result
    return None


def process_product(
    product: Mapping[str, Any],
    s3: Optional[WasabiStore],
    db: Optional[DatabaseStore],
    dry_run: bool = False,
    force: bool = False,
    storage_index: Optional[StorageImageIndex] = None,
    google_api_key: str = "",
    google_cx: str = "",
    max_external_candidates: int = 6,
) -> Dict[str, Any]:
    """Resolve no Wasabi/cache e consulta Google apenas quando nao ha match interno."""

    search_text = product_search_text(product)
    normalized_term = normalize_search_term(search_text)
    result = _result_base(product, normalized_term)
    if not text(product.get("name")):
        result["error"] = "produto sem nome"
        return result
    if len(text(product.get("name"))) > MAX_PRODUCT_NAME:
        result["error"] = "nome do produto excede o limite de %s caracteres" % MAX_PRODUCT_NAME
        return result
    if not normalized_term:
        result["error"] = "termo vazio apos normalizacao"
        return result

    if not force and not dry_run and s3:
        existing = _existing_image_result(product, normalized_term, s3)
        if existing:
            return existing
    elif not force and dry_run and (text(product.get("imageUrl")) or text(product.get("imageKey"))):
        result.update(
            {
                "status": "skipped-existing",
                "imageSource": "existing",
                "imageUrl": text(product.get("imageUrl")) or None,
                "s3Key": text(product.get("imageKey")) or None,
                "confidence": 1.0,
                "error": None,
            }
        )
        return result

    if dry_run:
        result["status"] = "dry-run"
        result["imageSource"] = "wasabi-storage"
        result["error"] = "nenhuma chamada externa feita (--dry-run)"
        return result

    if not s3:
        result["imageSource"] = "wasabi-storage"
        result["error"] = "conexao com o Wasabi indisponivel"
        return result

    identity_key = product_identity_key(product, normalized_term)
    lookup_terms = [normalized_term]
    if text(product.get("name")):
        lookup_terms.append(normalize_search_term(text(product.get("name"))))

    if db:
        for row in [db.lookup_registry(identity_key), db.lookup_cache(lookup_terms)]:
            cache_key = _cache_key_from_row(row)
            if not cache_key:
                continue
            try:
                cache_key = assert_safe_storage_key(cache_key)
                if s3.exists(cache_key):
                    result.update(
                        {
                            "status": "success",
                            "imageSource": "wasabi-storage",
                            "s3Key": cache_key,
                            "imageUrl": s3.public_url(cache_key),
                            "confidence": 0.99,
                            "attempts": 0,
                            "error": None,
                        }
                    )
                    return result
            except (WorkerError, StorageError) as exc:
                LOGGER.info("Cache ignorado para %s: %s", result["name"], exc)

    if storage_index:
        internal_match = storage_index.find(product)
        if internal_match:
            internal_key, internal_score = internal_match
            try:
                if s3.exists(internal_key):
                    image_url = s3.public_url(internal_key)
                    confidence = round(max(0.75, min(0.98, 0.72 + internal_score / 30.0)), 3)
                    if db:
                        db.save_cache(product, normalized_term, image_url, internal_key)
                        db.save_registry(product, identity_key, normalized_term, internal_key, confidence)
                    result.update(
                        {
                            "status": "success",
                            "imageSource": "wasabi-storage",
                            "imageUrl": image_url,
                            "s3Key": internal_key,
                            "score": internal_score,
                            "confidence": confidence,
                            "error": None,
                        }
                    )
                    return result
            except (WorkerError, StorageError) as exc:
                LOGGER.info("Match interno ignorado para %s: %s", result["name"], exc)

    from chromium_image_search import search_images
    try:
        raw_candidates = search_images(_google_query(product), limit=10)
    except Exception as exc:
        result["error"] = "Scraping Chromium indisponivel: " + str(exc)
        return result
    ranked_candidates = rank_google_image_candidates(
        raw_candidates,
        product,
        max_candidates=max_external_candidates,
    )
    result["imageSource"] = "chromium-search"
    result["candidateCount"] = len(ranked_candidates)

    for index, candidate in enumerate(ranked_candidates):
        result["attempts"] = index + 1
        source_url = text(candidate.get("url"))
        try:
            target_key = external_image_storage_key(source_url)
            if not s3.exists(target_key):
                processed_body = download_and_convert_external_image(source_url)
                s3.put_webp(target_key, processed_body)
            image_url = s3.public_url(target_key)
            confidence = float(candidate.get("confidence") or 0.42)
            if db:
                db.save_cache(product, normalized_term, image_url, target_key, source="chromium-search")
                db.save_registry(
                    product,
                    identity_key,
                    normalized_term,
                    target_key,
                    confidence,
                    source="chromium-search",
                    validation_level="external-ranked",
                    status="approved",
                    reason=text(candidate.get("reason")) or "Imagem externa selecionada pelo ranking do Google CSE",
                )
            result.update(
                {
                    "status": "success",
                    "imageSource": "chromium-search",
                    "imageUrl": image_url,
                    "s3Key": target_key,
                    "sourceUrl": source_url,
                    "sourceTitle": text(candidate.get("title")) or None,
                    "score": candidate.get("score"),
                    "confidence": confidence,
                    "error": None,
                }
            )
            return result
        except (ConfigurationError, StorageError, WorkerError, urllib.error.URLError, OSError) as exc:
            LOGGER.warning(
                "Candidato Google CSE %s nao foi processado para %s: %s",
                index + 1,
                result["name"],
                type(exc).__name__,
            )

    result["error"] = "nenhuma imagem correspondente encontrada no Wasabi nem no Google"
    return result

def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def write_manifest(path: str, manifest: Mapping[str, Any]) -> None:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=".%s." % output.name, suffix=".tmp", dir=str(output.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temp_name, str(output))
    finally:
        try:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
        except OSError:
            pass


def env_first(*names: str) -> str:
    for name in names:
        value = text(os.environ.get(name))
        if value:
            return value
    return ""


def load_env_file(path: str) -> None:
    """Carrega um .env simples sem sobrescrever variaveis ja exportadas."""

    env_path = Path(path)
    if not path or not env_path.is_file():
        return
    try:
        lines = env_path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        LOGGER.warning("Nao foi possivel ler %s: %s", path, exc)
        return
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, raw_value = line.split("=", 1)
        name = name.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name) or name in os.environ:
            continue
        value = raw_value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[name] = value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Resolve imagens com Wasabi primeiro e Google CSE como fallback")
    parser.add_argument("--input", "-i", required=True, help="JSON/JSONL/CSV/TSV; use - para stdin")
    parser.add_argument("--output", "-o", help="manifesto JSON de saida")
    parser.add_argument("--env-file", default=".env", help="arquivo .env opcional (padrao: .env)")
    parser.add_argument("--persist-db", action="store_true", help="tambem grava product_image_cache e registry")
    parser.add_argument("--dry-run", action="store_true", help="valida a lista sem chamar Wasabi ou PostgreSQL")
    parser.add_argument("--force", action="store_true", help="reprocessa e substitui imagem ja informada na lista")
    parser.add_argument("--max-products", type=int, default=0, help="limita a quantidade processada (0 = todos)")
    parser.add_argument("--max-candidates", type=int, default=6, help="quantidade maxima de imagens Google tentadas por produto (1-6)")
    parser.add_argument("--query-delay", type=float, default=0.35, help="pausa entre produtos em segundos")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    load_env_file(args.env_file)
    try:
        products = load_products(args.input)
    except WorkerError as exc:
        LOGGER.error("Entrada invalida: %s", exc)
        return 2
    if args.max_products and args.max_products > 0:
        products = products[: args.max_products]
    if not products:
        LOGGER.error("Nenhum produto encontrado na lista")
        return 2

    endpoint = env_first("WASABI_ENDPOINT") or "s3.wasabisys.com"
    bucket = env_first("WASABI_BUCKET") or "jobvarejo"
    region = env_first("WASABI_REGION") or "us-east-1"
    access_key = env_first("WASABI_ACCESS_KEY")
    secret_key = env_first("WASABI_SECRET_KEY")
    dsn = env_first("POSTGRES_DATABASE_URL", "DATABASE_URL", "NUXT_POSTGRES_DATABASE_URL")
    google_api_key = env_first("NUXT_GOOGLE_CSE_API_KEY", "GOOGLE_CSE_API_KEY")
    google_cx = env_first("NUXT_GOOGLE_CSE_CX", "GOOGLE_CSE_CX")
    max_external_candidates = max(1, min(6, int(args.max_candidates or 6)))

    if not args.dry_run:
        missing = []
        if not access_key:
            missing.append("WASABI_ACCESS_KEY")
        if not secret_key:
            missing.append("WASABI_SECRET_KEY")
        if missing:
            LOGGER.error("Configuracao ausente: %s", ", ".join(missing))
            return 2
        if args.persist_db and not dsn:
            LOGGER.error("--persist-db exige POSTGRES_DATABASE_URL (ou DATABASE_URL)")
            return 2
        if google_api_key and google_cx:
            LOGGER.info("Fallback Google CSE habilitado para itens sem match no Wasabi")
        elif google_api_key or google_cx:
            LOGGER.warning("Fallback Google CSE desabilitado: configuracao incompleta")

    output_path = args.output
    if not output_path:
        output_path = "product-image-manifest.json" if args.input == "-" else str(Path(args.input).with_suffix(".image-manifest.json"))

    s3: Optional[WasabiStore] = None
    db: Optional[DatabaseStore] = None
    storage_index: Optional[StorageImageIndex] = None
    try:
        if not args.dry_run:
            s3 = WasabiStore(endpoint, bucket, region, access_key, secret_key)
            try:
                storage_index = StorageImageIndex(s3.list_image_keys())
                LOGGER.info("Indice interno carregado com %s imagens", len(storage_index.entries))
            except StorageError as exc:
                LOGGER.warning("Nao foi possivel listar imagens internas; itens sem cache ficarao para escolha manual: %s", exc)
            if args.persist_db:
                db = DatabaseStore(
                    dsn,
                    user_id=env_first("PRODUCT_IMAGE_WORKER_USER_ID"),
                    validated_by=env_first("PRODUCT_IMAGE_WORKER_VALIDATED_BY") or "worker:google-cse",
                )

        results: List[Dict[str, Any]] = []
        for index, product in enumerate(products):
            LOGGER.info("[%s/%s] Processando %s", index + 1, len(products), text(product.get("name")) or "sem nome")
            if args.dry_run:
                item = process_product(product, None, None, dry_run=True, force=args.force)
            else:
                item = process_product(
                    product,
                    s3,
                    db,
                    force=args.force,
                    storage_index=storage_index,
                    google_api_key=google_api_key,
                    google_cx=google_cx,
                    max_external_candidates=max_external_candidates,
                )
            results.append(item)
            if args.query_delay > 0 and index < len(products) - 1:
                time.sleep(float(args.query_delay))

        success_count = sum(1 for item in results if item.get("status") in {"success", "dry-run", "skipped-existing"})
        manifest = {
            "generatedAt": _utc_now(),
            "provider": "wasabi-first-google-cse-fallback",
            "storage": {"endpoint": endpoint, "bucket": bucket, "prefix": "imagens/"},
            "total": len(results),
            "succeeded": success_count,
            "failed": len(results) - success_count,
            "results": results,
        }
        write_manifest(output_path, manifest)
        LOGGER.info("Manifesto salvo em %s (%s/%s concluido)", output_path, success_count, len(results))
        return 0 if success_count == len(results) else 2
    except (ConfigurationError, StorageError, WorkerError) as exc:
        LOGGER.error("Worker interrompido: %s", exc)
        return 2
    finally:
        if db:
            db.close()


if __name__ == "__main__":
    raise SystemExit(main())
