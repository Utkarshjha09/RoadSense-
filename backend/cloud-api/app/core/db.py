from __future__ import annotations

import time

from psycopg import Error as PsycopgError
from psycopg.errors import DeadlockDetected
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
            # Supabase pooler/PgBouncer can invalidate server-side prepared statements
            # across transaction-pooled connections. Disable auto-prepare in psycopg.
            kwargs={"autocommit": False, "prepare_threshold": None},
        )
        _pool.open(wait=True)
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def run_schema_migrations() -> None:
    max_attempts = 5
    backoff_seconds = 1.5
    for attempt in range(1, max_attempts + 1):
        try:
            pool = get_pool()
            with pool.connection() as conn:
                _create_sensor_events_table(conn)
                _create_predictions_table(conn)
                _create_training_samples_table(conn)
                conn.commit()
            return
        except DeadlockDetected:
            if attempt >= max_attempts:
                raise RuntimeError(
                    "Database migration deadlocked repeatedly. Retry deploy or disable worker-side migrations."
                ) from None
            time.sleep(backoff_seconds * attempt)
        except PsycopgError as exc:
            raise RuntimeError(
                "Database migration failed. Check DATABASE_URL and ensure schema permissions are correct."
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
        # Backward-compatible migration path for older schemas.
        cur.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'sensor_events' AND column_name = 'timestamp'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'sensor_events' AND column_name = 'event_ts'
                ) THEN
                    ALTER TABLE sensor_events RENAME COLUMN "timestamp" TO event_ts;
                END IF;
            END$$;
            """
        )
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS event_ts TIMESTAMPTZ;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS event_id TEXT;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS device_id TEXT;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS source TEXT;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS ax DOUBLE PRECISION;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS ay DOUBLE PRECISION;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS az DOUBLE PRECISION;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS gx DOUBLE PRECISION;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS gy DOUBLE PRECISION;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS gz DOUBLE PRECISION;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS speed DOUBLE PRECISION;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS ingest_mode TEXT;")
        cur.execute("ALTER TABLE sensor_events ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT NOW();")
        cur.execute(
            """
            UPDATE sensor_events
            SET event_id = CONCAT('legacy-', id::text)
            WHERE event_id IS NULL OR BTRIM(event_id) = '';
            """
        )
        cur.execute(
            """
            UPDATE sensor_events
            SET event_ts = COALESCE(event_ts, received_at, NOW())
            WHERE event_ts IS NULL;
            """
        )
        cur.execute(
            """
            UPDATE sensor_events
            SET
                device_id = COALESCE(NULLIF(device_id, ''), 'legacy-device'),
                source = COALESCE(NULLIF(source, ''), 'phone'),
                lat = COALESCE(lat, 0),
                lng = COALESCE(lng, 0),
                ax = COALESCE(ax, 0),
                ay = COALESCE(ay, 0),
                az = COALESCE(az, 0),
                gx = COALESCE(gx, 0),
                gy = COALESCE(gy, 0),
                gz = COALESCE(gz, 0)
            WHERE
                device_id IS NULL OR device_id = '' OR
                source IS NULL OR source = '' OR
                lat IS NULL OR lng IS NULL OR
                ax IS NULL OR ay IS NULL OR az IS NULL OR
                gx IS NULL OR gy IS NULL OR gz IS NULL;
            """
        )
        cur.execute(
            """
            UPDATE sensor_events
            SET ingest_mode = 'live'
            WHERE ingest_mode IS NULL;
            """
        )
        cur.execute("ALTER TABLE sensor_events ALTER COLUMN event_ts SET NOT NULL;")
        cur.execute("ALTER TABLE sensor_events ALTER COLUMN ingest_mode SET NOT NULL;")
        cur.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'sensor_events_source_check'
                ) THEN
                    ALTER TABLE sensor_events
                    ADD CONSTRAINT sensor_events_source_check
                    CHECK (source IN ('phone', 'esp32'));
                END IF;
            END$$;
            """
        )
        cur.execute("ALTER TABLE sensor_events ALTER COLUMN event_id SET NOT NULL;")
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_sensor_events_event_id_unique
            ON sensor_events (event_id);
            """
        )
        cur.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'sensor_events_ingest_mode_check'
                ) THEN
                    ALTER TABLE sensor_events
                    ADD CONSTRAINT sensor_events_ingest_mode_check
                    CHECK (ingest_mode IN ('live', 'sync'));
                END IF;
            END$$;
            """
        )
        # Some legacy datasets used a different schema in sensor_events.
        # If those columns exist, they must be nullable for ingestion inserts.
        cur.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sensor_events' AND column_name = 'predicted_type'
                ) THEN
                    ALTER TABLE sensor_events ALTER COLUMN predicted_type DROP NOT NULL;
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sensor_events' AND column_name = 'confidence'
                ) THEN
                    ALTER TABLE sensor_events ALTER COLUMN confidence DROP NOT NULL;
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sensor_events' AND column_name = 'sample_count'
                ) THEN
                    ALTER TABLE sensor_events ALTER COLUMN sample_count DROP NOT NULL;
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sensor_events' AND column_name = 'location'
                ) THEN
                    ALTER TABLE sensor_events ALTER COLUMN location DROP NOT NULL;
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sensor_events' AND column_name = 'cluster_id'
                ) THEN
                    ALTER TABLE sensor_events ALTER COLUMN cluster_id DROP NOT NULL;
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sensor_events' AND column_name = 'user_id'
                ) THEN
                    ALTER TABLE sensor_events ALTER COLUMN user_id DROP NOT NULL;
                END IF;
            END$$;
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
        # Backward-compatible migration path for older/custom predictions schema.
        cur.execute("ALTER TABLE predictions ADD COLUMN IF NOT EXISTS event_id TEXT;")
        cur.execute("ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_type TEXT;")
        cur.execute("ALTER TABLE predictions ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION;")
        cur.execute(
            "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS model_version TEXT NOT NULL DEFAULT 'placeholder-v1';"
        )
        cur.execute("ALTER TABLE predictions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();")
        cur.execute(
            """
            UPDATE predictions
            SET model_version = 'placeholder-v1'
            WHERE model_version IS NULL OR BTRIM(model_version) = '';
            """
        )
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_event_id_unique
            ON predictions (event_id);
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_predictions_type_created
            ON predictions (predicted_type, created_at DESC);
            """
        )


def _create_training_samples_table(conn: Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS training_samples (
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
                predicted_type TEXT NULL CHECK (predicted_type IN ('SMOOTH', 'POTHOLE', 'SPEED_BUMP')),
                predicted_confidence DOUBLE PRECISION NULL CHECK (predicted_confidence >= 0 AND predicted_confidence <= 1),
                true_label TEXT NULL CHECK (true_label IN ('SMOOTH', 'POTHOLE', 'SPEED_BUMP')),
                label_source TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS event_id TEXT;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS device_id TEXT;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS source TEXT;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS event_ts TIMESTAMPTZ;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS ax DOUBLE PRECISION;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS ay DOUBLE PRECISION;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS az DOUBLE PRECISION;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS gx DOUBLE PRECISION;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS gy DOUBLE PRECISION;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS gz DOUBLE PRECISION;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS speed DOUBLE PRECISION;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS predicted_type TEXT;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS predicted_confidence DOUBLE PRECISION;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS true_label TEXT;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS label_source TEXT;")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();")
        cur.execute("ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();")
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_training_samples_event_id_unique
            ON training_samples (event_id);
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_training_samples_true_label
            ON training_samples (true_label);
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_training_samples_event_ts
            ON training_samples (event_ts DESC);
            """
        )
