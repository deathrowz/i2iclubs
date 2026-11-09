import type { UserProfile, UserRole } from '../../types/domain';

/**
 * Identity helpers shared by the public snapshot, the sign-in resolver and the
 * login screens. Pure: no Next.js or Supabase imports, so they run under tsx.
 */

/** The only user fields an anonymous caller may see. */
export interface PublicProfile {
  id: string;
  full_name: string;
  role: UserRole;
  school_id: string | null;
  school_name?: string;
  club_id: string | null;
  club_name?: string;
}

/** Strips contact details, login codes and identity-provider ids. */
export function toPublicProfile(u: UserProfile): PublicProfile {
  return {
    id: u.id,
    full_name: u.full_name,
    role: u.role,
    school_id: u.school_id,
    school_name: u.school_name,
    club_id: u.club_id,
    club_name: u.club_name,
  };
}

const digitsOnly = (s: string) => s.replace(/\D/g, '');

/**
 * Whether a typed sign-in identifier names this user. The identifier must be
 * trimmed and lower-cased by the caller.
 *
 * Deliberately excludes the internal `id` and `auth_user_id`: those were once
 * accepted, which made them a lookup key for anyone who had seen them.
 */
export function matchesLoginIdentifier(u: UserProfile, identifier: string): boolean {
  if (!identifier) return false;

  const email = u.email.toLowerCase();
  const code = u.login_code?.toLowerCase() ?? '';
  const schoolCode = u.school_code?.toLowerCase() ?? '';
  const phone = digitsOnly(u.phone_number ?? '');
  const typedPhone = digitsOnly(identifier);

  if (email === identifier) return true;
  if (code && code === identifier) return true;
  if (schoolCode && schoolCode === identifier) return true;
  if (typedPhone && phone === typedPhone) return true;
  if (identifier.endsWith('-club') && code === `${identifier.replace('-club', '')}-student`) return true;
  if (identifier.endsWith('-student') && code === identifier) return true;
  if (identifier.endsWith('-teacher') && code === identifier) return true;
  return false;
}
