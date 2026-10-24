import { UserProfile, UserRole } from '@/types/domain';
import { getPlatformStore } from '@/lib/store/platform-store';
import { createServerSupabase } from '@/lib/supabase/server';

export const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin'];

export function isAdminRole(role?: UserRole | null): boolean {
  return Boolean(role && ADMIN_ROLES.includes(role));
}

/**
 * Resolves the signed-in Supabase auth user to a platform profile.
 *
 * Matching order: `auth_user_id` (authoritative), then verified email. Newly
 * matched profiles have their `auth_user_id` stitched on so subsequent lookups
 * are direct.
 */
export async function getSignedInProfile(): Promise<UserProfile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const store = getPlatformStore();

  const byAuthId = store.users.find((u) => u.auth_user_id === user.id);
  if (byAuthId) return byAuthId;

  const email = user.email?.toLowerCase();
  if (!email) return null;

  const byEmail = store.users.find((u) => u.email.toLowerCase() === email);
  if (byEmail) {
    byEmail.auth_user_id = user.id;
    return byEmail;
  }

  return null;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Guard for admin-only route handlers. Throws AuthError, which the route
 * handler converts into a JSON response.
 */
export async function requireAdmin(): Promise<UserProfile> {
  const profile = await getSignedInProfile();
  if (!profile) {
    throw new AuthError('Sign in required.', 401);
  }
  if (!isAdminRole(profile.role)) {
    throw new AuthError('Administrator access required.', 403);
  }
  return profile;
}

/** Guard for destructive/mutating operations — super admin only. */
export async function requireSuperAdmin(): Promise<UserProfile> {
  const profile = await getSignedInProfile();
  if (!profile) throw new AuthError('Sign in required.', 401);
  if (profile.role !== 'super_admin') {
    throw new AuthError('Super administrator access required.', 403);
  }
  return profile;
}
