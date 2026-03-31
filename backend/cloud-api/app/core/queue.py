from __future__ import annotations

import json
from typing import Any

from app.core.settings import get_queue_max_length, get_queue_name, get_redis_url

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
    max_length = get_queue_max_length()
    pipe = client.pipeline()
    pipe.rpush(queue_name, *payload)
    # Keep only the newest entries to avoid stale backlogs.
    pipe.ltrim(queue_name, -max_length, -1)
    pipe.llen(queue_name)
    _, _, queue_length = pipe.execute()
    return int(queue_length)


def pop_event(timeout_seconds: int = 5) -> dict[str, Any] | None:
    client = get_redis()
    queue_name = get_queue_name()
    result = client.blpop(queue_name, timeout=timeout_seconds)
    if result is None:
        return None
    _, raw = result
    return json.loads(raw)


def pop_events_batch(max_items: int, timeout_seconds: int = 5) -> list[dict[str, Any]]:
    if max_items <= 0:
        return []

    client = get_redis()
    queue_name = get_queue_name()
    first = client.blpop(queue_name, timeout=timeout_seconds)
    if first is None:
        return []

    _, raw_first = first
    items = [json.loads(raw_first)]
    remaining = max_items - 1
    if remaining <= 0:
        return items

    # Drain additional items immediately without blocking to increase worker throughput.
    extra_raw = client.lpop(queue_name, remaining)
    if extra_raw is None:
        return items
    if isinstance(extra_raw, list):
        items.extend(json.loads(raw) for raw in extra_raw)
    else:
        items.append(json.loads(extra_raw))
    return items
