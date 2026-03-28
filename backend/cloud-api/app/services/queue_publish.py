from __future__ import annotations

from app.core.queue import push_events
from app.models.events import EventRecord


def enqueue_for_inference(events: list[EventRecord]) -> int:
    payload = [event.model_dump(mode="json") for event in events]
    return push_events(payload)

