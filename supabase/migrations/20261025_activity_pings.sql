-- ============================================================================
-- ACTIVITY PINGS
-- One row per heartbeat from a signed-in user. Powers "last seen" and
-- "hours this week" in the admin console, and survives restarts.
-- Written only by the server (service role); no public access.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_pings (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_pings_user_time
    ON public.activity_pings (user_id, at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_pings_at
    ON public.activity_pings (at DESC);

ALTER TABLE public.activity_pings ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies: anon/authenticated cannot read or write.
-- The server uses the service-role key, which bypasses RLS.

-- Keep the table from growing without bound; 180 days is well beyond the
-- reporting window the console uses.
CREATE OR REPLACE FUNCTION public.prune_activity_pings()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    DELETE FROM public.activity_pings WHERE at < NOW() - INTERVAL '180 days';
$$;
