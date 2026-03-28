# RoadSense n8n Municipal Alert Agent

This setup creates an n8n "agent" that:

1. Polls processed road results (clustered model output) from Supabase
2. Scores severity (potholes/speed bumps + confidence + volume + recency)
3. Finds nearby municipal authority by geospatial coverage
4. Sends alert (email/webhook; SMS can be added)
5. Logs dispatch history to prevent spam/cooldown duplicates

---

## 1) Apply DB migration

Run this migration in Supabase SQL Editor:

- `backend/supabase/migrations/006_add_municipal_alert_agent.sql`

It adds:

- `municipal_authorities` (authority coverage + contacts)
- `municipal_alert_dispatches` (dispatch log)
- RPC: `get_municipal_alert_candidates(...)`
- RPC: `log_municipal_alert_dispatch(...)`

---

## 2) Seed municipal authority rows

Example SQL:

```sql
INSERT INTO public.municipal_authorities
    (name, zone_code, ward_name, contact_email, contact_phone, preferred_channel, location, coverage_radius_meters, active)
VALUES
    (
        'Bhopal Municipal Zone 5',
        'BH-Z5',
        'Ward 42',
        'zone5-alerts@municipal.example',
        '+91XXXXXXXXXX',
        'email',
        ST_SetSRID(ST_MakePoint(77.3611, 23.2599), 4326)::geography,
        7000,
        TRUE
    );
```

---

## 3) Import n8n workflow

Import:

- `backend/n8n/municipal-alert-agent.workflow.json`

In n8n set environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALERT_FROM_EMAIL`
- `ALERT_REPLY_TO_EMAIL` (optional)
- `ALERT_SMS_WEBHOOK_URL` (required for SMS fallback path)

Configure email credentials on node `Send Email Alert`.
The n8n Email Send node uses Nodemailer internally (SMTP transport), so this
already satisfies "mail sent by Nodemailer".

For webhook channel alerts, set `webhook_url` in `municipal_authorities`.
For SMS fallback, `ALERT_SMS_WEBHOOK_URL` should point to your SMS provider
adapter endpoint (Twilio/MSG91/custom gateway).

Recommended SMTP fields for clear municipal delivery:

- From Name: `RoadSense Alerts`
- From Email: `ALERT_FROM_EMAIL`
- Reply-To: `ALERT_REPLY_TO_EMAIL` (or same as from)
- Enable HTML + text fallback (already configured in workflow)

---

## 4) CSV logger integration (optional but useful)

Your mobile logger already exports CSV manually (`mobile/app/logger.tsx`).

Recommended n8n add-on flow:

1. Trigger on uploaded CSV (Drive/S3/Email attachment)
2. Parse CSV
3. Aggregate counts:
   - `POTHOLE`
   - `SPEED_BUMP`
   - speed/confidence metrics (if present in CSV)
4. Store summary in your analytics table or send daily municipal digest.

If you want, we can add a dedicated `csv_ingest_logs` table + import workflow next.

---

## 5) How routing works

`get_municipal_alert_candidates` chooses nearest active authority where:

- cluster location is within authority coverage radius
- state is `POTHOLE` or `SPEED_BUMP`
- severity score >= threshold
- last dispatch is older than cooldown

Default workflow values:

- Poll interval: every 5 minutes
- Severity threshold: `0.55`
- Cooldown: `90` minutes

Tune these in n8n request body:

```json
{
  "p_limit": 50,
  "p_cooldown_minutes": 90,
  "p_min_severity_score": 0.55
}
```

---

## 6) Production hardening checklist

1. Use dedicated service-role key only in n8n secret manager.
2. Add retry + dead-letter workflow in n8n for failed sends.
3. Add Twilio/MSG91 node for SMS to `contact_phone`.
4. Add escalation rule:
   - severity >= 0.8 -> SMS + email + webhook
5. Add daily summary digest per zone.

---

## 7) If You Want To Replace n8n (more efficiency)

Yes. Best alternatives for this workload:

1. **Supabase Edge Functions + pg_cron (recommended for your current stack)**
   - Lowest latency and less moving parts
   - Strong for SQL-heavy routing + scheduled dispatch
   - You already use Supabase, so ops is simpler

2. **Temporal.io**
   - Best for durable workflows/retries/escalations at scale
   - More complex to operate than n8n

3. **BullMQ + Node worker (Redis)**
   - Good throughput and controlled retry/backoff
   - Requires maintaining worker infra

If your main goal is efficiency + reliability in your current architecture,
move this agent into **Supabase Edge Function + pg_cron**.
