-- ============================================================================
-- PLATFORM FEATURE FLAGS (Super Admin console)
-- Single-row table holding the platform's capability switches.
-- Written only by the server (service role); no public access.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_features (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

INSERT INTO public.platform_features (id, features)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_features ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies: anon/authenticated cannot read or write.
-- The server uses the service-role key, which bypasses RLS.
