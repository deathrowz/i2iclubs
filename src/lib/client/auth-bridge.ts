import type { UserProfile } from '@/types/domain';

/**
 * Browser helpers for the sign-in screens. The browser never holds the full
 * user list, so identifiers are resolved and the session profile is fetched
 * from the server.
 */

/** Resolves a typed email, login code, phone or school code to an account. */
export async function resolveLoginIdentifier(identifier: string): Promise<UserProfile | null> {
  try {
    const res = await fetch('/api/auth/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.profile as UserProfile | null) ?? null;
  } catch {
    return null;
  }
}

/** The profile of the current verified session, or null when signed out. */
export async function fetchSessionProfile(): Promise<UserProfile | null> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.profile as UserProfile) ?? null;
  } catch {
    return null;
  }
}
