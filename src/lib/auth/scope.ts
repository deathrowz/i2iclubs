import type { ImpactLog, UserProfile, UserRole } from '../../types/domain';

/**
 * Pure authorisation helpers for API route handlers.
 *
 * Kept free of Next.js and Supabase imports so they can be unit-tested with
 * plain `tsx`. The route handlers resolve the caller from the verified
 * Supabase session (`getSignedInProfile`) and pass that profile in here; the
 * client never supplies its own identity.
 */

/** Roles that may read every impact log on the platform. */
const GLOBAL_LOG_READERS: UserRole[] = ['super_admin', 'admin', 'expert_admin', 'expert'];

/**
 * Returns the server-verified actor id, ignoring any `actorId` the client sent.
 * Route handlers must write `actorId` through this, never from the body.
 */
export function bindActor<T extends object>(
  body: T,
  profile: Pick<UserProfile, 'id'>
): T & { actorId: string } {
  return { ...body, actorId: profile.id };
}

/**
 * Restricts impact logs to what the given profile may read:
 * - admins and experts: every log
 * - teachers and students: logs from their own school
 * - mentors: logs from their assigned clubs
 * - anyone else: nothing
 */
export function scopeImpactLogs(
  profile: Pick<UserProfile, 'role' | 'school_id' | 'assigned_club_ids'>,
  logs: ImpactLog[]
): ImpactLog[] {
  const role = profile.role;
  if (GLOBAL_LOG_READERS.includes(role)) return logs;

  if ((role === 'teacher' || role === 'student') && profile.school_id) {
    return logs.filter((l) => l.school_id === profile.school_id);
  }

  if (role === 'mentor') {
    const assigned = profile.assigned_club_ids ?? [];
    return logs.filter((l) => assigned.includes(l.club_id));
  }

  return [];
}
