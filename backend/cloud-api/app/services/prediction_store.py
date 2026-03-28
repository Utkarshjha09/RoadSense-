from __future__ import annotations

from app.core.db import get_pool


def upsert_prediction(
    *,
    event_id: str,
    predicted_type: str,
    confidence: float,
    model_version: str,
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
        conn.commit()


def fetch_latest_predictions(*, limit: int, predicted_type: str | None = None) -> list[dict[str, object]]:
    pool = get_pool()
    where_sql = ""
    params: dict[str, object] = {"limit": limit}
    if predicted_type:
        where_sql = "WHERE p.predicted_type = %(predicted_type)s"
        params["predicted_type"] = predicted_type

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
            s.lng,
            s.address
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
