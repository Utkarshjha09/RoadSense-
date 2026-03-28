from __future__ import annotations

import os


def get_database_url() -> str:
    value = os.getenv("DATABASE_URL", "").strip()
    if not value:
        raise RuntimeError(
            "DATABASE_URL is not set. Configure it before starting cloud-api."
        )
    return value


def get_redis_url() -> str:
    value = os.getenv("REDIS_URL", "").strip()
    if not value:
        raise RuntimeError(
            "REDIS_URL is not set. Configure it before using the ingestion queue."
        )
    return value


def get_queue_name() -> str:
    return os.getenv("EVENT_QUEUE_NAME", "roadsense:events").strip() or "roadsense:events"
