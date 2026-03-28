from __future__ import annotations

from psycopg import Error as PsycopgError
from psycopg import Connection
from psycopg_pool import ConnectionPool

from app.core.settings import get_database_url

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=get_database_url(),
            min_size=1,
            max_size=10,
            timeout=10,
            kwargs={"autocommit": False},
        )
        _pool.open(wait=True)
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def run_schema_migrations() -> None:
    try:
        pool = get_pool()
        with pool.connection() as conn:
            _create_sensor_events_table(conn)
            _create_predictions_table(conn)
            conn.commit()
    except PsycopgError as exc:
        raise RuntimeError(
            "Unable to connect to Postgres. Ensure DATABASE_URL is correct and the DB server is running."
        ) from exc


def _create_sensor_events_table(conn: Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS sensor_events (
                id BIGSERIAL PRIMARY KEY,
                event_id TEXT NOT NULL UNIQUE,
                device_id TEXT NOT NULL,
                source TEXT NOT NULL CHECK (source IN ('phone', 'esp32')),
                event_ts TIMESTAMPTZ NOT NULL,
                lat DOUBLE PRECISION NOT NULL,
                lng DOUBLE PRECISION NOT NULL,
                ax DOUBLE PRECISION NOT NULL,
                ay DOUBLE PRECISION NOT NULL,
                az DOUBLE PRECISION NOT NULL,
                gx DOUBLE PRECISION NOT NULL,
                gy DOUBLE PRECISION NOT NULL,
                gz DOUBLE PRECISION NOT NULL,
                speed DOUBLE PRECISION NULL,
                ingest_mode TEXT NOT NULL CHECK (ingest_mode IN ('live', 'sync')),
                received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_sensor_events_event_ts
            ON sensor_events (event_ts DESC);
            """
        )


def _create_predictions_table(conn: Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS predictions (
                id BIGSERIAL PRIMARY KEY,
                event_id TEXT NOT NULL UNIQUE REFERENCES sensor_events(event_id) ON DELETE CASCADE,
                predicted_type TEXT NOT NULL CHECK (predicted_type IN ('SMOOTH', 'POTHOLE', 'SPEED_BUMP')),
                confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
                model_version TEXT NOT NULL DEFAULT 'placeholder-v1',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_predictions_type_created
            ON predictions (predicted_type, created_at DESC);
            """
        )
