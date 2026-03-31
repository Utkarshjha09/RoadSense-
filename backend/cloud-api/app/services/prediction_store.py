from __future__ import annotations

from app.core.db import get_pool
from app.models.events import EventRecord


def upsert_prediction(
    *,
    event_id: str,
    predicted_type: str,
    confidence: float,
    model_version: str,
    latitude: float | None = None,
    longitude: float | None = None,
    speed: float | None = None,
) -> None:
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO predictions (
                    event_id,
                    predicted_type,
                    confidence,
                    model_version
                )
                VALUES (
                    %(event_id)s,
                    %(predicted_type)s,
                    %(confidence)s,
                    %(model_version)s
                )
                ON CONFLICT (event_id)
                DO UPDATE SET
                    predicted_type = EXCLUDED.predicted_type,
                    confidence = EXCLUDED.confidence,
                    model_version = EXCLUDED.model_version;
                """,
                {
                    "event_id": event_id,
                    "predicted_type": predicted_type,
                    "confidence": confidence,
                    "model_version": model_version,
                },
            )
            cur.execute(
                """
                UPDATE training_samples
                SET
                    predicted_type = %(predicted_type)s,
                    predicted_confidence = %(confidence)s,
                    updated_at = NOW()
                WHERE event_id = %(event_id)s;
                """,
                {
                    "event_id": event_id,
                    "predicted_type": predicted_type,
                    "confidence": confidence,
                },
            )

            # Mirror high-confidence anomaly predictions into the anomalies table
            # so web "Anomaly Management" and "Map View" stay populated.
            if (
                predicted_type in {"POTHOLE", "SPEED_BUMP"}
                and confidence >= 0.60
                and latitude is not None
                and longitude is not None
            ):
                try:
                    cur.execute(
                        """
                        INSERT INTO anomalies (
                            user_id,
                            type,
                            severity,
                            confidence,
                            location,
                            speed,
                            image_url
                        )
                        SELECT
                            NULL,
                            %(predicted_type)s,
                            %(confidence)s,
                            %(confidence)s,
                            ST_SetSRID(ST_MakePoint(%(longitude)s, %(latitude)s), 4326)::geography,
                            %(speed)s,
                            NULL
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM anomalies a
                            WHERE a.type = %(predicted_type)s
                              AND a.created_at >= NOW() - INTERVAL '2 minutes'
                              AND ST_DWithin(
                                  a.location,
                                  ST_SetSRID(ST_MakePoint(%(longitude)s, %(latitude)s), 4326)::geography,
                                  12
                              )
                        );
                        """,
                        {
                            "predicted_type": predicted_type,
                            "confidence": confidence,
                            "latitude": latitude,
                            "longitude": longitude,
                            "speed": speed,
                        },
                    )
                except Exception as exc:
                    print(f"[prediction_store] anomaly mirror insert skipped: {exc}")
        conn.commit()


def fetch_latest_predictions(
    *,
    limit: int,
    predicted_type: str | None = None,
    device_id: str | None = None,
    source: str | None = None,
) -> list[dict[str, object]]:
    pool = get_pool()
    where_clauses: list[str] = []
    params: dict[str, object] = {"limit": limit}
    if predicted_type:
        where_clauses.append("p.predicted_type = %(predicted_type)s")
        params["predicted_type"] = predicted_type
    if device_id:
        where_clauses.append("s.device_id = %(device_id)s")
        params["device_id"] = device_id
    if source:
        where_clauses.append("s.source = %(source)s")
        params["source"] = source

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    query = f"""
        SELECT
            p.event_id,
            p.predicted_type,
            p.confidence,
            p.model_version,
            p.created_at,
            s.device_id,
            s.source,
            s.event_ts,
            s.lat,
            s.lng
        FROM predictions p
        JOIN sensor_events s ON s.event_id = p.event_id
        {where_sql}
        ORDER BY p.created_at DESC
        LIMIT %(limit)s;
    """

    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            columns = [desc.name for desc in cur.description]

    return [dict(zip(columns, row, strict=False)) for row in rows]


def upsert_training_sample(event: EventRecord) -> None:
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
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
        conn.commit()


def update_training_label(*, event_id: str, true_label: str, label_source: str) -> bool:
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE training_samples
                SET
                    true_label = %(true_label)s,
                    label_source = %(label_source)s,
                    updated_at = NOW()
                WHERE event_id = %(event_id)s
                RETURNING id;
                """,
                {
                    "event_id": event_id,
                    "true_label": true_label,
                    "label_source": label_source,
                },
            )
            row = cur.fetchone()
        conn.commit()
    return row is not None
