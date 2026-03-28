from __future__ import annotations

from dataclasses import dataclass

from app.core.db import get_pool
from app.models.events import EventRecord


@dataclass(frozen=True)
class BatchIngestResult:
    received: int
    inserted: int
    duplicates: int
    inserted_event_ids: list[str]


def persist_event_batch(events: list[EventRecord], ingest_mode: str) -> BatchIngestResult:
    pool = get_pool()
    inserted = 0
    inserted_event_ids: list[str] = []

    with pool.connection() as conn:
        with conn.cursor() as cur:
            for event in events:
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
                if sensor_inserted:
                    inserted += 1
                    inserted_event_ids.append(event.event_id)
        conn.commit()

    received = len(events)
    duplicates = received - inserted
    return BatchIngestResult(
        received=received,
        inserted=inserted,
        duplicates=duplicates,
        inserted_event_ids=inserted_event_ids,
    )
