from __future__ import annotations

from dataclasses import dataclass
import os

from psycopg.errors import DeadlockDetected, QueryCanceled

from app.core.db import get_pool
from app.models.events import EventRecord


@dataclass(frozen=True)
class BatchIngestResult:
    received: int
    inserted: int
    duplicates: int
    inserted_event_ids: list[str]


def _chunk_size() -> int:
    raw = os.getenv("INGEST_BATCH_SIZE", "25").strip()
    try:
        value = int(raw)
    except ValueError:
        return 25
    return max(1, min(value, 200))


def _sync_statement_timeout_ms() -> int:
    raw = os.getenv("SYNC_STATEMENT_TIMEOUT_MS", "25000").strip()
    try:
        value = int(raw)
    except ValueError:
        return 25000
    return max(5000, min(value, 120000))


def _insert_event_pair(cur, event: EventRecord, ingest_mode: str) -> bool:
    cur.execute(
        """
        INSERT INTO sensor_events (
            event_id,
            device_id,
            source,
            event_ts,
            lat,
            lng,
            ax,
            ay,
            az,
            gx,
            gy,
            gz,
            speed,
            ingest_mode
        )
        VALUES (
            %(event_id)s,
            %(device_id)s,
            %(source)s,
            %(event_ts)s,
            %(lat)s,
            %(lng)s,
            %(ax)s,
            %(ay)s,
            %(az)s,
            %(gx)s,
            %(gy)s,
            %(gz)s,
            %(speed)s,
            %(ingest_mode)s
        )
        ON CONFLICT (event_id) DO NOTHING
        RETURNING id;
        """,
        {
            "event_id": event.event_id,
            "device_id": event.device_id,
            "source": event.source.value,
            "event_ts": event.timestamp,
            "lat": event.lat,
            "lng": event.lng,
            "ax": event.ax,
            "ay": event.ay,
            "az": event.az,
            "gx": event.gx,
            "gy": event.gy,
            "gz": event.gz,
            "speed": event.speed,
            "ingest_mode": ingest_mode,
        },
    )
    sensor_inserted = cur.fetchone() is not None
    cur.execute(
        """
        INSERT INTO training_samples (
            event_id,
            device_id,
            source,
            event_ts,
            lat,
            lng,
            ax,
            ay,
            az,
            gx,
            gy,
            gz,
            speed
        )
        VALUES (
            %(event_id)s,
            %(device_id)s,
            %(source)s,
            %(event_ts)s,
            %(lat)s,
            %(lng)s,
            %(ax)s,
            %(ay)s,
            %(az)s,
            %(gx)s,
            %(gy)s,
            %(gz)s,
            %(speed)s
        )
        ON CONFLICT (event_id) DO UPDATE
        SET
            device_id = EXCLUDED.device_id,
            source = EXCLUDED.source,
            event_ts = EXCLUDED.event_ts,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            ax = EXCLUDED.ax,
            ay = EXCLUDED.ay,
            az = EXCLUDED.az,
            gx = EXCLUDED.gx,
            gy = EXCLUDED.gy,
            gz = EXCLUDED.gz,
            speed = EXCLUDED.speed,
            updated_at = NOW();
        """,
        {
            "event_id": event.event_id,
            "device_id": event.device_id,
            "source": event.source.value,
            "event_ts": event.timestamp,
            "lat": event.lat,
            "lng": event.lng,
            "ax": event.ax,
            "ay": event.ay,
            "az": event.az,
            "gx": event.gx,
            "gy": event.gy,
            "gz": event.gz,
            "speed": event.speed,
        },
    )
    return sensor_inserted


def persist_event_batch(events: list[EventRecord], ingest_mode: str) -> BatchIngestResult:
    pool = get_pool()
    inserted = 0
    inserted_event_ids: list[str] = []
    batch_size = _chunk_size()
    statement_timeout_ms = _sync_statement_timeout_ms() if ingest_mode == "sync" else 0

    with pool.connection() as conn:
        for start in range(0, len(events), batch_size):
            chunk = events[start:start + batch_size]
            try:
                with conn.cursor() as cur:
                    if statement_timeout_ms > 0:
                        cur.execute(f"SET LOCAL statement_timeout = {statement_timeout_ms};")
                    for event in chunk:
                        sensor_inserted = _insert_event_pair(cur, event, ingest_mode)
                        if sensor_inserted:
                            inserted += 1
                            inserted_event_ids.append(event.event_id)
                conn.commit()
            except (QueryCanceled, DeadlockDetected):
                # Don't fail whole sync batch on one locked/slow index path.
                conn.rollback()
                for event in chunk:
                    try:
                        with conn.cursor() as cur:
                            if statement_timeout_ms > 0:
                                cur.execute(f"SET LOCAL statement_timeout = {statement_timeout_ms};")
                            sensor_inserted = _insert_event_pair(cur, event, ingest_mode)
                        conn.commit()
                        if sensor_inserted:
                            inserted += 1
                            inserted_event_ids.append(event.event_id)
                    except (QueryCanceled, DeadlockDetected):
                        conn.rollback()
                        continue
                    except Exception:
                        conn.rollback()
                        raise
            except Exception:
                conn.rollback()
                raise

    received = len(events)
    duplicates = received - inserted
    return BatchIngestResult(
        received=received,
        inserted=inserted,
        duplicates=duplicates,
        inserted_event_ids=inserted_event_ids,
    )
