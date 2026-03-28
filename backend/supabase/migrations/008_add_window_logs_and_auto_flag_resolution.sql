-- ============================================================================
-- RoadSense: Window logs for retraining + automatic flag resolution
-- ============================================================================
-- Adds:
-- 1) sensor_window_logs: per-window telemetry summary (geo + parameters)
-- 2) auto_resolve_cluster_after_passes: deactivate flags after enough smooth passes
-- 3) record_sensor_event override to apply auto-resolve policy after each event
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sensor_window_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('phone', 'esp32')),
    device_id TEXT,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    sample_count INTEGER NOT NULL CHECK (sample_count > 0),
    predicted_type TEXT NOT NULL CHECK (predicted_type IN ('SMOOTH', 'POTHOLE', 'SPEED_BUMP')),
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    features_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    window_started_at TIMESTAMP WITH TIME ZONE,
    window_ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_window_logs_created_at
ON public.sensor_window_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_window_logs_location
ON public.sensor_window_logs USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));

ALTER TABLE public.sensor_window_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own window logs" ON public.sensor_window_logs;
CREATE POLICY "Users can view their own window logs"
ON public.sensor_window_logs
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Only admins can view all window logs" ON public.sensor_window_logs;
CREATE POLICY "Only admins can view all window logs"
ON public.sensor_window_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

DROP POLICY IF EXISTS "Only admins can modify window logs directly" ON public.sensor_window_logs;
CREATE POLICY "Only admins can modify window logs directly"
ON public.sensor_window_logs
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE OR REPLACE FUNCTION public.insert_sensor_window_log(
    p_user_id UUID,
    p_source TEXT,
    p_device_id TEXT,
    p_latitude FLOAT,
    p_longitude FLOAT,
    p_sample_count INTEGER,
    p_predicted_type TEXT,
    p_confidence FLOAT,
    p_features_summary JSONB DEFAULT '{}'::jsonb,
    p_window_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_window_ended_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.sensor_window_logs (
        user_id,
        source,
        device_id,
        latitude,
        longitude,
        sample_count,
        predicted_type,
        confidence,
        features_summary,
        window_started_at,
        window_ended_at
    )
    VALUES (
        p_user_id,
        p_source,
        p_device_id,
        p_latitude,
        p_longitude,
        p_sample_count,
        p_predicted_type,
        p_confidence,
        COALESCE(p_features_summary, '{}'::jsonb),
        p_window_started_at,
        p_window_ended_at
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.auto_resolve_cluster_after_passes(
    p_cluster_id UUID,
    p_required_events INTEGER DEFAULT 3000,
    p_max_issue_ratio FLOAT DEFAULT 0.05
)
RETURNS TABLE (
    cluster_id UUID,
    current_state TEXT,
    confidence_score FLOAT,
    active BOOLEAN,
    observed_events INTEGER,
    issue_events INTEGER,
    issue_ratio FLOAT
) AS $$
DECLARE
    v_total INTEGER := 0;
    v_issues INTEGER := 0;
    v_ratio FLOAT := 1;
    v_state TEXT := 'SMOOTH';
    v_conf FLOAT := 0;
    v_active BOOLEAN := TRUE;
BEGIN
    WITH recent AS (
        SELECT predicted_type
        FROM public.sensor_events se
        WHERE se.cluster_id = p_cluster_id
        ORDER BY se.event_at DESC
        LIMIT p_required_events
    )
    SELECT
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE predicted_type IN ('POTHOLE', 'SPEED_BUMP'))::INTEGER
    INTO v_total, v_issues
    FROM recent;

    IF v_total > 0 THEN
        v_ratio := v_issues::FLOAT / v_total::FLOAT;
    END IF;

    IF v_total >= p_required_events AND v_ratio <= p_max_issue_ratio THEN
        UPDATE public.road_state_clusters c
        SET
            active = FALSE,
            current_state = 'SMOOTH',
            confidence_score = GREATEST(0.9, 1 - v_ratio),
            updated_at = NOW()
        WHERE c.id = p_cluster_id;
    END IF;

    SELECT c.current_state, c.confidence_score, c.active
    INTO v_state, v_conf, v_active
    FROM public.road_state_clusters c
    WHERE c.id = p_cluster_id;

    RETURN QUERY
    SELECT
        p_cluster_id,
        v_state,
        v_conf,
        v_active,
        v_total,
        v_issues,
        v_ratio;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_sensor_event(
    p_user_id UUID,
    p_source TEXT,
    p_device_id TEXT,
    p_predicted_type TEXT,
    p_confidence FLOAT,
    p_sample_count INTEGER,
    p_latitude FLOAT,
    p_longitude FLOAT,
    p_cluster_radius_meters FLOAT DEFAULT 12
)
RETURNS TABLE (
    event_id UUID,
    cluster_id UUID,
    current_state TEXT,
    confidence_score FLOAT,
    active BOOLEAN
) AS $$
DECLARE
    new_event_id UUID;
    target_cluster_id UUID;
BEGIN
    target_cluster_id := public.find_or_create_road_state_cluster(
        p_latitude,
        p_longitude,
        p_cluster_radius_meters
    );

    INSERT INTO public.sensor_events(
        cluster_id,
        user_id,
        source,
        device_id,
        predicted_type,
        confidence,
        sample_count,
        location,
        event_at
    )
    VALUES (
        target_cluster_id,
        p_user_id,
        p_source,
        p_device_id,
        p_predicted_type,
        p_confidence,
        p_sample_count,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        NOW()
    )
    RETURNING id INTO new_event_id;

    PERFORM * FROM public.refresh_road_state_cluster(target_cluster_id);
    PERFORM * FROM public.auto_resolve_cluster_after_passes(target_cluster_id, 3000, 0.05);

    RETURN QUERY
    SELECT
        new_event_id,
        c.id,
        c.current_state,
        c.confidence_score,
        c.active
    FROM public.road_state_clusters c
    WHERE c.id = target_cluster_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

