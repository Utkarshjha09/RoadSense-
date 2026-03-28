# RoadSense Cloud API

Starter backend scaffold for cloud inference and anomaly services.

## Structure

- `app/api`
- `app/core`
- `app/models`
- `app/services`
- `app/workers`

## Run locally

```bash
pip install -r requirements.txt
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/roadsense
set REDIS_URL=redis://localhost:6379/0
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Health check: `GET /health`

### Start Postgres + Redis locally (Docker)

```bash
docker compose up -d
```

Then run the API with `DATABASE_URL` and `REDIS_URL`.

## Event ingestion (Step 3)

- `POST /v1/events/batch`
- `POST /v1/sync/batch`

Both endpoints persist the same event schema into `sensor_events` with idempotency on `event_id`.

## Queue + Worker (Step 4)

- API enqueues newly inserted events into Redis list `roadsense:events`.
- Worker consumes queue, runs placeholder cloud inference, and stores into `predictions`.

Run worker in another terminal:

```bash
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/roadsense
set REDIS_URL=redis://localhost:6379/0
python -m app.workers.inference_worker
```

Read latest predictions:

- `GET /v1/predictions/latest`
- `GET /v1/predictions/latest?limit=50`
- `GET /v1/predictions/latest?predicted_type=POTHOLE`

## Dev cleanup endpoint

Enable dev endpoints:

```bash
set ALLOW_DEV_ENDPOINTS=1
```

Then use:

- `DELETE /v1/test-data` (removes placeholder test rows)
- `DELETE /v1/test-data?clear_all=true` (truncates predictions + events)
