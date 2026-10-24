-- ============================================================================
-- CLUB PERSISTENCE
-- Clubs and their membership were seeded from code and held in process
-- memory, so creating, renaming or deleting a club was lost on restart.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clubs_store (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubs_store_school
    ON public.clubs_store ((data ->> 'school_id'));

-- Membership: one club per person. A null club_id means "not in a club".
CREATE TABLE IF NOT EXISTS public.club_members (
    user_id TEXT PRIMARY KEY,
    club_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_members_club
    ON public.club_members (club_id);

-- Small key/value table so the seed import runs exactly once, even if every
-- club is later deleted.
CREATE TABLE IF NOT EXISTS public.platform_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clubs_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_meta ENABLE ROW LEVEL SECURITY;

-- No policies by design: service role only.
