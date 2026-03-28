from __future__ import annotations

from app.core.db import get_pool


def delete_placeholder_test_data() -> int:
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM sensor_events
                WHERE event_id IN ('string', 'test', 'example')
                   OR device_id IN ('string', 'test', 'example')
                   OR (lat = -90 AND lng = -180);
                """
            )
            deleted = cur.rowcount
        conn.commit()
    return int(deleted)


def truncate_all_event_data() -> None:
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE predictions, sensor_events RESTART IDENTITY CASCADE;")
        conn.commit()

