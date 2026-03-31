from __future__ import annotations

import os
import time

from app.core.db import close_pool, run_schema_migrations
from app.core.queue import close_redis, pop_event
from app.models.events import EventRecord
from app.services.inference import classify_event
from app.services.prediction_store import upsert_prediction


def run_forever() -> None:
    skip_worker_migrations = os.getenv("WORKER_SKIP_DB_MIGRATIONS", "1").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    if not skip_worker_migrations:
        run_schema_migrations()
    print("[worker] started, waiting for queued events...")

    while True:
        item = pop_event(timeout_seconds=5)
        if item is None:
            continue

        try:
            event = EventRecord.model_validate(item)
            prediction = classify_event(event)
            upsert_prediction(
                event_id=event.event_id,
                predicted_type=prediction.predicted_type,
                confidence=prediction.confidence,
                model_version=prediction.model_version,
                latitude=event.lat,
                longitude=event.lng,
                speed=event.speed,
            )
            print(
                f"[worker] processed event_id={event.event_id} "
                f"type={prediction.predicted_type} conf={prediction.confidence:.2f}"
            )
        except Exception as exc:
            # Keep worker resilient; skip bad message and continue.
            print(f"[worker] failed to process message: {exc}")
            time.sleep(0.1)


if __name__ == "__main__":
    try:
        run_forever()
    except KeyboardInterrupt:
        print("[worker] stopped by user")
    finally:
        close_redis()
        close_pool()
