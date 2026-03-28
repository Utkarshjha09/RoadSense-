-- Fix PL/pgSQL ambiguity between RETURNS TABLE column names and table columns.
-- This updates the aggregation functions in-place for existing databases.

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
        COUNT(*) FILTER (WHERE se.predicted_type = 'POTHOLE'),
        COUNT(*) FILTER (WHERE se.predicted_type = 'SMOOTH'),
        COUNT(*) FILTER (WHERE se.predicted_type = 'SPEED_BUMP'),
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
