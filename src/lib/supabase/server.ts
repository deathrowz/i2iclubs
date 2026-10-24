import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const DEFAULT_SUPABASE_URL = 'http://localhost:8000';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyMTc0MzI5LCJleHAiOjE5NDk4NTQzMjl9.LAXhM4gFBYfOr5bStoFMn77aK0MdRu6z6fVHrzzInPc';

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
}

export function isSupabaseReady(): boolean {
  const url = getSupabaseUrl();
  return Boolean(url && !url.includes('your-project-id'));
}

/**
 * Cookie-bound Supabase client for server components and route handlers.
 * Reads/writes the auth session through Next.js cookies.
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a server component render — safe to ignore; the
          // middleware refreshes the session cookie.
        }
      },
    },
  }) as unknown as SupabaseClient;
}

/**
 * Service-role client. Server-only — never import this into a client component.
 * Returns null when no service key is configured.
 */
export function createServiceSupabase(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !isSupabaseReady()) return null;

  return createClient(getSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
