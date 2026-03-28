-- ============================================================================
-- RoadSense Municipal Alert Agent (n8n-ready)
-- ============================================================================
-- Purpose:
-- 1) Store municipal authority contact + service coverage
-- 2) Generate alert candidates from processed road-state clusters
-- 3) Prevent spam via cooldown checks
-- 4) Log dispatches from n8n (email/sms/webhook/etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.municipal_authorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    zone_code TEXT,
    ward_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    preferred_channel TEXT NOT NULL DEFAULT 'email'
        CHECK (preferred_channel IN ('email', 'sms', 'webhook')),
    webhook_url TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    coverage_radius_meters FLOAT NOT NULL DEFAULT 5000 CHECK (coverage_radius_meters > 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_municipal_authorities_location
ON public.municipal_authorities USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_municipal_authorities_active
ON public.municipal_authorities(active);

CREATE TABLE IF NOT EXISTS public.municipal_alert_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES public.road_state_clusters(id) ON DELETE CASCADE,
    authority_id UUID NOT NULL REFERENCES public.municipal_authorities(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'webhook', 'manual')),
    status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
    severity_score FLOAT NOT NULL CHECK (severity_score >= 0 AND severity_score <= 1),
    payload JSONB,
    external_reference TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_municipal_alert_dispatches_cluster_authority
ON public.municipal_alert_dispatches(cluster_id, authority_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_municipal_alert_dispatches_sent_at
ON public.municipal_alert_dispatches(sent_at DESC);

ALTER TABLE public.municipal_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_alert_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view municipal authorities" ON public.municipal_authorities;
CREATE POLICY "Admins can view municipal authorities"
ON public.municipal_authorities
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner')
    )
);

DROP POLICY IF EXISTS "Admins can manage municipal authorities" ON public.municipal_authorities;
CREATE POLICY "Admins can manage municipal authorities"
ON public.municipal_authorities
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner')
    )
);

DROP POLICY IF EXISTS "Admins can view alert dispatch logs" ON public.municipal_alert_dispatches;
CREATE POLICY "Admins can view alert dispatch logs"
ON public.municipal_alert_dispatches
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner')
    )
);

DROP POLICY IF EXISTS "Admins can manage alert dispatch logs" ON public.municipal_alert_dispatches;
CREATE POLICY "Admins can manage alert dispatch logs"
ON public.municipal_alert_dispatches
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner')
    )
);

-- Keep updated_at fresh.
DROP TRIGGER IF EXISTS update_municipal_authorities_updated_at ON public.municipal_authorities;
CREATE TRIGGER update_municipal_authorities_updated_at
    BEFORE UPDATE ON public.municipal_authorities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Return high-priority, nearby anomalies/cluster states for alerting.
CREATE OR REPLACE FUNCTION public.get_municipal_alert_candidates(
    p_limit INTEGER DEFAULT 50,
    p_cooldown_minutes INTEGER DEFAULT 90,
    p_min_severity_score FLOAT DEFAULT 0.55
)
RETURNS TABLE (
    cluster_id UUID,
    latitude FLOAT,
    longitude FLOAT,
    current_state TEXT,
    confidence_score FLOAT,
    total_events INTEGER,
    last_event_at TIMESTAMP WITH TIME ZONE,
    severity_score FLOAT,
    authority_id UUID,
    authority_name TEXT,
    authority_email TEXT,
    authority_phone TEXT,
    preferred_channel TEXT,
    webhook_url TEXT,
    zone_code TEXT,
    distance_meters FLOAT,
    last_dispatched_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH base AS (
        SELECT
            c.id AS c_id,
            c.location,
            c.current_state,
            c.confidence_score,
            c.total_events,
            c.last_event_at,
            -- Severity formula tuned for municipal escalation.
            LEAST(
                1.0,
                (
                    CASE
                        WHEN c.current_state = 'POTHOLE' THEN 0.50
                        WHEN c.current_state = 'SPEED_BUMP' THEN 0.35
                        ELSE 0.0
                    END
                    + (c.confidence_score * 0.30)
                    + (LEAST(c.total_events::FLOAT / 20.0, 1.0) * 0.15)
                    + (
                        CASE
                            WHEN c.last_event_at IS NULL THEN 0.0
                            WHEN c.last_event_at >= NOW() - INTERVAL '6 hours' THEN 0.05
                            ELSE 0.0
                        END
                    )
                )
            ) AS score
        FROM public.road_state_clusters c
        WHERE c.active = TRUE
          AND c.current_state IN ('POTHOLE', 'SPEED_BUMP')
          AND c.last_event_at IS NOT NULL
    ),
    matched AS (
        SELECT
            b.*,
            a.id AS a_id,
            a.name AS a_name,
            a.contact_email AS a_email,
            a.contact_phone AS a_phone,
            a.preferred_channel,
            a.webhook_url,
            a.zone_code,
            ST_Distance(b.location, a.location) AS dist_meters
        FROM base b
        JOIN LATERAL (
            SELECT ma.*
            FROM public.municipal_authorities ma
            WHERE ma.active = TRUE
              AND ST_DWithin(b.location, ma.location, ma.coverage_radius_meters)
            ORDER BY ST_Distance(b.location, ma.location)
            LIMIT 1
        ) a ON TRUE
    ),
    recent_dispatch AS (
        SELECT
            d.cluster_id,
            d.authority_id,
            MAX(d.sent_at) AS last_sent
        FROM public.municipal_alert_dispatches d
        GROUP BY d.cluster_id, d.authority_id
    )
    SELECT
        m.c_id AS cluster_id,
        ST_Y(m.location::geometry) AS latitude,
        ST_X(m.location::geometry) AS longitude,
        m.current_state,
        m.confidence_score,
        m.total_events,
        m.last_event_at,
        m.score AS severity_score,
        m.a_id AS authority_id,
        m.a_name AS authority_name,
        m.a_email AS authority_email,
        m.a_phone AS authority_phone,
        m.preferred_channel,
        m.webhook_url,
        m.zone_code,
        m.dist_meters AS distance_meters,
        rd.last_sent AS last_dispatched_at
    FROM matched m
    LEFT JOIN recent_dispatch rd
        ON rd.cluster_id = m.c_id
       AND rd.authority_id = m.a_id
    WHERE m.score >= p_min_severity_score
      AND (
          rd.last_sent IS NULL
          OR rd.last_sent < NOW() - MAKE_INTERVAL(mins => p_cooldown_minutes)
      )
    ORDER BY m.score DESC, m.last_event_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Called by n8n after attempting a send.
CREATE OR REPLACE FUNCTION public.log_municipal_alert_dispatch(
    p_cluster_id UUID,
    p_authority_id UUID,
    p_channel TEXT,
    p_status TEXT,
    p_severity_score FLOAT,
    p_payload JSONB DEFAULT NULL,
    p_external_reference TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO public.municipal_alert_dispatches(
        cluster_id,
        authority_id,
        channel,
        status,
        severity_score,
        payload,
        external_reference
    )
    VALUES (
        p_cluster_id,
        p_authority_id,
        p_channel,
        p_status,
        p_severity_score,
        p_payload,
        p_external_reference
    )
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

