-- ============================================================================
-- USER PROFILE PERSISTENCE
-- Profiles lived only in process memory, so anyone created in the console
-- vanished on restart while their Supabase Auth account survived — the two
-- records could drift apart.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users_store (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_store_role
    ON public.users_store ((data ->> 'role'));

CREATE INDEX IF NOT EXISTS idx_users_store_email
    ON public.users_store (lower(data ->> 'email'));

ALTER TABLE public.users_store ENABLE ROW LEVEL SECURITY;

-- No policies by design: service role only.
