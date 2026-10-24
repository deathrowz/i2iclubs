import { NextRequest, NextResponse } from 'next/server';
import { AuthError, requireAdmin, requireSuperAdmin } from '@/lib/auth/guards';
import { getPlatformStore, getUserActivitySummaries } from '@/lib/store/platform-store';
import { ensureClubsHydrated } from '@/lib/store/club-repository';
import { createServiceSupabase } from '@/lib/supabase/server';
import { UserProfile, UserRole } from '@/types/domain';

export const dynamic = 'force-dynamic';

const ASSIGNABLE_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'expert_admin',
  'expert',
  'teacher',
  'student',
  'mentor',
];

export async function GET() {
  try {
    await requireAdmin();
    await ensureClubsHydrated();
    const store = getPlatformStore();
    const activity = await getUserActivitySummaries();

    return NextResponse.json({
      ok: true,
      users: store.users.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        login_code: u.login_code,
        organization: u.organization,
        school_id: u.school_id,
        school_code: u.school_code,
        club_id: u.club_id,
        club_name: u.club_name,
        hasPassword: Boolean(u.auth_user_id),
        lastSeenAt: activity[u.id]?.lastSeenAt ?? null,
        hoursLast7Days: activity[u.id]?.hoursLast7Days ?? 0,
      })),
      roles: ASSIGNABLE_ROLES,
      schools: store.schools.map((s) => ({ id: s.id, code: s.code, name: s.name })),
      clubs: store.clubs.map((c) => ({ id: c.id, name: c.name, school_code: c.school_code })),
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to load users' },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = await req.json();

    const email = String(body.email ?? '').trim().toLowerCase();
    const fullName = String(body.fullName ?? '').trim();
    const role = String(body.role ?? '') as UserRole;
    const password = String(body.password ?? '');

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'A valid email address is required.' }, { status: 422 });
    }
    if (!fullName) {
      return NextResponse.json({ ok: false, error: 'Full name is required.' }, { status: 422 });
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json({ ok: false, error: 'Unknown role.' }, { status: 422 });
    }
    if (password && password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 422 });
    }

    const store = getPlatformStore();
    if (store.users.some((u) => u.email.toLowerCase() === email)) {
      return NextResponse.json({ ok: false, error: 'A user with that email already exists.' }, { status: 409 });
    }

    const schoolId = body.schoolId || null;
    const school = schoolId ? store.schools.find((s) => s.id === schoolId) : null;
    const club = schoolId ? store.clubs.find((c) => c.school_id === schoolId) : null;

    let authUserId: string | undefined;

    // Create the real sign-in account when a service key is configured.
    const supabase = createServiceSupabase();
    if (supabase && password) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) {
        return NextResponse.json(
          { ok: false, error: `Could not create sign-in account: ${error.message}` },
          { status: 422 }
        );
      }
      authUserId = data.user?.id;
    }

    const created: UserProfile = {
      id: `usr-${Date.now().toString(36)}`,
      auth_user_id: authUserId,
      email,
      login_code: email.split('@')[0].toUpperCase(),
      full_name: fullName,
      role,
      organization: school?.name ?? 'I2I Clubs',
      school_id: schoolId,
      school_name: school?.name,
      school_code: school?.code,
      club_id: club?.id ?? null,
      club_name: club?.name,
    };

    store.users.push(created);

    return NextResponse.json({
      ok: true,
      user: created,
      signInCreated: Boolean(authUserId),
      note: authUserId
        ? 'Sign-in account created.'
        : 'Profile created only — configure SUPABASE_SERVICE_ROLE_KEY and set a password to enable sign-in.',
      createdBy: actor.email,
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to create user' },
      { status }
    );
  }
}
