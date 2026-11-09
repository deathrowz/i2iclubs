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

/**
 * Impact-log fields an anonymous caller may see. An allowlist, so a field added
 * later is hidden by default. Excluded: student identity, Telegram handle,
 * proof-file location (`s3_url`, `s3_key`), EXIF coordinates and device data.
 */
const PUBLIC_IMPACT_LOG_FIELDS = [
  'id',
  'club_id',
  'club_name',
  'school_id',
  'school_name',
  'school_code',
  'activity_title',
  'activity_category',
  'transaction_type',
  'waste_kg',
  'revenue_usd',
  'co2_saved_kg',
  'status',
  'points_awarded',
  'is_final_pitch',
  'created_at',
  'updated_at',
] as const;

type Row = Record<string, unknown>;

export function toPublicImpactLog(log: object): Row {
  const src = log as Row;
  const out: Row = {};
  for (const key of PUBLIC_IMPACT_LOG_FIELDS) {
    if (key in src) out[key] = src[key];
  }
  return out;
}

/** The parts of the platform snapshot this module redacts. */
export interface RedactableSnapshot {
  users: UserProfile[];
  impactLogs: object[];
  whatsappMessages: unknown[];
  telegramMessages: unknown[];
  auditLogs: unknown[];
  clubs: object[];
  leaderboard?: object[];
}

/**
 * Snapshot for an anonymous caller. Keeps the leaderboard, school and club
 * facts; removes personal data:
 * - users: contact details, login codes, identity ids
 * - impact logs: student identity, proof-file locations, EXIF location
 * - WhatsApp and Telegram messages and audit trail: removed entirely (they name
 *   students and phone numbers, and only the admin console needs them)
 * - club org charts: student names (`holder_name`) removed
 */
/** Removes student names from a club's org chart; keeps the roles. */
function redactClub(club: object): Row {
  const row = club as Row;
  const orgChart = row.org_chart;
  if (!Array.isArray(orgChart)) return row;
  return {
    ...row,
    org_chart: orgChart.map((member: Row) => {
      const { holder_name: _omit, ...rest } = member;
      return rest;
    }),
  };
}

export function toPublicSnapshot<S extends RedactableSnapshot>(snapshot: S): S {
  const redacted = {
    ...snapshot,
    users: snapshot.users.map(toPublicProfile),
    impactLogs: snapshot.impactLogs.map(toPublicImpactLog),
    whatsappMessages: [],
    telegramMessages: [],
    auditLogs: [],
    clubs: snapshot.clubs.map(redactClub),
    // Each leaderboard row embeds its full club, org chart included.
    leaderboard: snapshot.leaderboard?.map((entry) => {
      const row = entry as Row;
      return row.club ? { ...row, club: redactClub(row.club as object) } : row;
    }),
  };
  return redacted as unknown as S;
}
