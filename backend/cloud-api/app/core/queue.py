from __future__ import annotations

import json
from typing import Any

from app.core.settings import get_queue_name, get_redis_url

_redis: Any | None = None


def get_redis() -> Any:
    global _redis
    if _redis is None:
        try:
            from redis import Redis  # Lazy import so API can start even if package is missing.
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "Redis client package is missing. Run: pip install -r requirements.txt"
            ) from exc
        _redis = Redis.from_url(get_redis_url(), decode_responses=True)
    return _redis


def close_redis() -> None:
    global _redis
    if _redis is not None:
        _redis.close()
        _redis = None


def push_events(items: list[dict[str, Any]]) -> int:
    if not items:
        return 0
    client = get_redis()
    queue_name = get_queue_name()
    payload = [json.dumps(item) for item in items]
    return int(client.rpush(queue_name, *payload))


def pop_event(timeout_seconds: int = 5) -> dict[str, Any] | None:
    client = get_redis()
    queue_name = get_queue_name()
    result = client.blpop(queue_name, timeout=timeout_seconds)
    if result is None:
        return None
    _, raw = result
    return json.loads(raw)
