-- ============================================================================
-- RoadSense Repair Validation (next N vehicle readings)
-- ============================================================================
-- Goal:
-- After municipality marks a location as repaired, evaluate next N processed
-- readings (default 3000) and classify:
-- - REPAIRED
-- - REMAINING_ISSUES
-- - WAITING_DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.road_repair_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES public.road_state_clusters(id) ON DELETE CASCADE,
    marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELLED')),
    address_text TEXT,
    sample_goal INTEGER NOT NULL DEFAULT 3000 CHECK (sample_goal > 0),
    marked_repaired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_road_repair_requests_cluster
ON public.road_repair_requests(cluster_id);

CREATE INDEX IF NOT EXISTS idx_road_repair_requests_status
ON public.road_repair_requests(status);

CREATE INDEX IF NOT EXISTS idx_road_repair_requests_marked_repaired_at
ON public.road_repair_requests(marked_repaired_at DESC);

ALTER TABLE public.road_repair_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view road repair requests" ON public.road_repair_requests;
CREATE POLICY "Admins can view road repair requests"
ON public.road_repair_requests
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner')
    )
);

DROP POLICY IF EXISTS "Admins can manage road repair requests" ON public.road_repair_requests;
CREATE POLICY "Admins can manage road repair requests"
ON public.road_repair_requests
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

DROP TRIGGER IF EXISTS update_road_repair_requests_updated_at ON public.road_repair_requests;
CREATE TRIGGER update_road_repair_requests_updated_at
    BEFORE UPDATE ON public.road_repair_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Mark a cluster as repaired (or refresh an existing completed row).
CREATE OR REPLACE FUNCTION public.mark_cluster_repaired(
    p_cluster_id UUID,
    p_marked_by UUID DEFAULT NULL,
    p_address_text TEXT DEFAULT NULL,
    p_sample_goal INTEGER DEFAULT 3000,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    existing_id UUID;
BEGIN
    SELECT r.id
    INTO existing_id
    FROM public.road_repair_requests r
    WHERE r.cluster_id = p_cluster_id
      AND r.status = 'COMPLETED'
    ORDER BY r.marked_repaired_at DESC
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
        UPDATE public.road_repair_requests
        SET
            marked_by = COALESCE(p_marked_by, marked_by),
            address_text = COALESCE(p_address_text, address_text),
            sample_goal = COALESCE(p_sample_goal, sample_goal),
            notes = COALESCE(p_notes, notes),
            marked_repaired_at = NOW(),
            updated_at = NOW()
        WHERE id = existing_id;

        RETURN existing_id;
    END IF;

    INSERT INTO public.road_repair_requests(
        cluster_id,
        marked_by,
        status,
        address_text,
        sample_goal,
        marked_repaired_at,
        notes
    )
    VALUES (
        p_cluster_id,
        p_marked_by,
        'COMPLETED',
        p_address_text,
        p_sample_goal,
        NOW(),
        p_notes
    )
    RETURNING id INTO existing_id;

    RETURN existing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stats for dashboard:
-- Evaluate next sample_goal sensor events after repair.
CREATE OR REPLACE FUNCTION public.get_repair_validation_stats(
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    repair_id UUID,
    cluster_id UUID,
    latitude FLOAT,
    longitude FLOAT,
    address_text TEXT,
    marked_repaired_at TIMESTAMP WITH TIME ZONE,
    sample_goal INTEGER,
    observed_events INTEGER,
    smooth_events INTEGER,
    pothole_events INTEGER,
    speed_bump_events INTEGER,
    remaining_events INTEGER,
    repaired_percent FLOAT,
    status_label TEXT,
    latest_event_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH repaired AS (
        SELECT
            r.id AS repair_id,
            r.cluster_id,
            r.address_text,
            r.marked_repaired_at,
            r.sample_goal,
            c.location
        FROM public.road_repair_requests r
        JOIN public.road_state_clusters c ON c.id = r.cluster_id
        WHERE r.status = 'COMPLETED'
    ),
    post_events AS (
        SELECT
            rr.repair_id,
            rr.cluster_id,
            rr.sample_goal,
            rr.marked_repaired_at,
            rr.address_text,
            rr.location,
            se.predicted_type,
            se.event_at,
            ROW_NUMBER() OVER (PARTITION BY rr.repair_id ORDER BY se.event_at ASC) AS rn
        FROM repaired rr
        LEFT JOIN public.sensor_events se
          ON se.cluster_id = rr.cluster_id
         AND se.event_at > rr.marked_repaired_at
    ),
    limited AS (
        SELECT *
        FROM post_events
        WHERE rn <= sample_goal
    ),
    agg AS (
        SELECT
            l.repair_id,
            l.cluster_id,
            l.address_text,
            l.marked_repaired_at,
            l.sample_goal,
            l.location,
            COUNT(*) FILTER (WHERE l.predicted_type IS NOT NULL) AS observed_events,
            COUNT(*) FILTER (WHERE l.predicted_type = 'SMOOTH') AS smooth_events,
            COUNT(*) FILTER (WHERE l.predicted_type = 'POTHOLE') AS pothole_events,
            COUNT(*) FILTER (WHERE l.predicted_type = 'SPEED_BUMP') AS speed_bump_events,
            MAX(l.event_at) AS latest_event_at
        FROM limited l
        GROUP BY
            l.repair_id,
            l.cluster_id,
            l.address_text,
            l.marked_repaired_at,
            l.sample_goal,
            l.location
    )
    SELECT
        a.repair_id,
        a.cluster_id,
        ST_Y(a.location::geometry) AS latitude,
        ST_X(a.location::geometry) AS longitude,
        a.address_text,
        a.marked_repaired_at,
        a.sample_goal,
        a.observed_events,
        a.smooth_events,
        a.pothole_events,
        a.speed_bump_events,
        (a.pothole_events + a.speed_bump_events) AS remaining_events,
        CASE
            WHEN a.observed_events = 0 THEN 0
            ELSE ROUND(((a.smooth_events::FLOAT / a.observed_events::FLOAT) * 100)::NUMERIC, 2)::FLOAT
        END AS repaired_percent,
        CASE
            WHEN a.observed_events < a.sample_goal THEN 'WAITING_DATA'
            WHEN (a.pothole_events + a.speed_bump_events) <= CEIL(a.sample_goal * 0.05) THEN 'REPAIRED'
            ELSE 'REMAINING_ISSUES'
        END AS status_label,
        a.latest_event_at
    FROM agg a
    ORDER BY a.marked_repaired_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

