-- ============================================================================
-- RoadSense Continuous Road-State Aggregation
-- ============================================================================
-- Purpose:
-- 1. Store every model prediction as a raw sensor event
-- 2. Group nearby events into location clusters
-- 3. Maintain current road truth for each cluster over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.road_state_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    radius_meters FLOAT NOT NULL DEFAULT 12 CHECK (radius_meters > 0),
    current_state TEXT NOT NULL DEFAULT 'SMOOTH' CHECK (current_state IN ('SMOOTH', 'POTHOLE', 'SPEED_BUMP')),
    confidence_score FLOAT NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    pothole_votes INTEGER NOT NULL DEFAULT 0 CHECK (pothole_votes >= 0),
    smooth_votes INTEGER NOT NULL DEFAULT 0 CHECK (smooth_votes >= 0),
    speed_bump_votes INTEGER NOT NULL DEFAULT 0 CHECK (speed_bump_votes >= 0),
    total_events INTEGER NOT NULL DEFAULT 0 CHECK (total_events >= 0),
    active BOOLEAN NOT NULL DEFAULT FALSE,
    last_event_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_road_state_clusters_location
ON public.road_state_clusters USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_road_state_clusters_state
ON public.road_state_clusters(current_state);

CREATE TABLE IF NOT EXISTS public.sensor_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID REFERENCES public.road_state_clusters(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('phone', 'esp32')),
    device_id TEXT,
    predicted_type TEXT NOT NULL CHECK (predicted_type IN ('SMOOTH', 'POTHOLE', 'SPEED_BUMP')),
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    sample_count INTEGER NOT NULL DEFAULT 100 CHECK (sample_count > 0),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    event_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_events_cluster_id
ON public.sensor_events(cluster_id);

CREATE INDEX IF NOT EXISTS idx_sensor_events_event_at
ON public.sensor_events(event_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_events_location
ON public.sensor_events USING GIST(location);

ALTER TABLE public.road_state_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view road state clusters" ON public.road_state_clusters;
CREATE POLICY "Anyone can view road state clusters"
ON public.road_state_clusters
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Only admins can modify road state clusters directly" ON public.road_state_clusters;
CREATE POLICY "Only admins can modify road state clusters directly"
ON public.road_state_clusters
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

DROP POLICY IF EXISTS "Users can view their own sensor events" ON public.sensor_events;
CREATE POLICY "Users can view their own sensor events"
ON public.sensor_events
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Only admins can view all sensor events" ON public.sensor_events;
CREATE POLICY "Only admins can view all sensor events"
ON public.sensor_events
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

DROP POLICY IF EXISTS "Only admins can modify sensor events directly" ON public.sensor_events;
CREATE POLICY "Only admins can modify sensor events directly"
ON public.sensor_events
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

CREATE OR REPLACE FUNCTION public.find_or_create_road_state_cluster(
    p_latitude FLOAT,
    p_longitude FLOAT,
    p_radius_meters FLOAT DEFAULT 12
)
RETURNS UUID AS $$
DECLARE
    found_cluster_id UUID;
    point GEOGRAPHY(POINT, 4326);
BEGIN
    point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

    SELECT id
    INTO found_cluster_id
    FROM public.road_state_clusters
    WHERE ST_DWithin(location, point, p_radius_meters)
    ORDER BY ST_Distance(location, point)
    LIMIT 1;

    IF found_cluster_id IS NOT NULL THEN
        RETURN found_cluster_id;
    END IF;

    INSERT INTO public.road_state_clusters(location, radius_meters, current_state, active, last_event_at)
    VALUES (point, p_radius_meters, 'SMOOTH', FALSE, NOW())
    RETURNING id INTO found_cluster_id;

    RETURN found_cluster_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refresh_road_state_cluster(
    p_cluster_id UUID,
    p_lookback_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    cluster_id UUID,
    current_state TEXT,
    confidence_score FLOAT,
    pothole_votes INTEGER,
    smooth_votes INTEGER,
    speed_bump_votes INTEGER,
    total_events INTEGER,
    active BOOLEAN
) AS $$
DECLARE
    pothole_count INTEGER := 0;
    smooth_count INTEGER := 0;
    bump_count INTEGER := 0;
    total_count INTEGER := 0;
    winning_state TEXT := 'SMOOTH';
    winning_votes INTEGER := 0;
    winning_confidence FLOAT := 0;
    should_be_active BOOLEAN := FALSE;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE predicted_type = 'POTHOLE'),
        COUNT(*) FILTER (WHERE predicted_type = 'SMOOTH'),
        COUNT(*) FILTER (WHERE predicted_type = 'SPEED_BUMP'),
        COUNT(*)
    INTO pothole_count, smooth_count, bump_count, total_count
    FROM public.sensor_events AS se
    WHERE se.cluster_id = p_cluster_id
      AND se.event_at >= NOW() - MAKE_INTERVAL(days => p_lookback_days);

    winning_votes := GREATEST(pothole_count, smooth_count, bump_count);

    IF total_count = 0 THEN
        winning_state := 'SMOOTH';
        winning_confidence := 0;
        should_be_active := FALSE;
    ELSIF pothole_count = winning_votes THEN
        winning_state := 'POTHOLE';
        winning_confidence := pothole_count::FLOAT / total_count::FLOAT;
        should_be_active := pothole_count >= smooth_count;
    ELSIF bump_count = winning_votes THEN
        winning_state := 'SPEED_BUMP';
        winning_confidence := bump_count::FLOAT / total_count::FLOAT;
        should_be_active := bump_count >= smooth_count;
    ELSE
        winning_state := 'SMOOTH';
        winning_confidence := smooth_count::FLOAT / total_count::FLOAT;
        should_be_active := FALSE;
    END IF;

    UPDATE public.road_state_clusters AS c
    SET
        current_state = winning_state,
        confidence_score = winning_confidence,
        pothole_votes = pothole_count,
        smooth_votes = smooth_count,
        speed_bump_votes = bump_count,
        total_events = total_count,
        active = should_be_active,
        last_event_at = (
            SELECT MAX(se.event_at)
            FROM public.sensor_events AS se
            WHERE se.cluster_id = p_cluster_id
        ),
        updated_at = NOW()
    WHERE c.id = p_cluster_id;

    RETURN QUERY
    SELECT
        c.id,
        c.current_state,
        c.confidence_score,
        c.pothole_votes,
        c.smooth_votes,
        c.speed_bump_votes,
        c.total_events,
        c.active
    FROM public.road_state_clusters AS c
    WHERE c.id = p_cluster_id;
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

    RETURN QUERY
    WITH refreshed AS (
        SELECT *
        FROM public.refresh_road_state_cluster(target_cluster_id)
    )
    SELECT
        new_event_id,
        refreshed.cluster_id,
        refreshed.current_state,
        refreshed.confidence_score,
        refreshed.active
    FROM refreshed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_active_road_state_in_viewport(
    min_lat FLOAT,
    min_lng FLOAT,
    max_lat FLOAT,
    max_lng FLOAT,
    limit_count INTEGER DEFAULT 1000
)
RETURNS TABLE (
    id UUID,
    current_state TEXT,
    confidence_score FLOAT,
    latitude FLOAT,
    longitude FLOAT,
    pothole_votes INTEGER,
    smooth_votes INTEGER,
    speed_bump_votes INTEGER,
    total_events INTEGER,
    last_event_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.current_state,
        c.confidence_score,
        ST_Y(c.location::geometry) AS latitude,
        ST_X(c.location::geometry) AS longitude,
        c.pothole_votes,
        c.smooth_votes,
        c.speed_bump_votes,
        c.total_events,
        c.last_event_at
    FROM public.road_state_clusters c
    WHERE c.active = TRUE
      AND ST_Intersects(
          c.location,
          ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
      )
    ORDER BY c.last_event_at DESC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

DROP TRIGGER IF EXISTS update_road_state_clusters_updated_at ON public.road_state_clusters;
CREATE TRIGGER update_road_state_clusters_updated_at
    BEFORE UPDATE ON public.road_state_clusters
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
