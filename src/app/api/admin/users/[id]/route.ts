import { NextRequest, NextResponse } from 'next/server';
import { AuthError, isAdminRole, requireSuperAdmin } from '@/lib/auth/guards';
import { assignUserToClub, getPlatformStore } from '@/lib/store/platform-store';
import { deleteUserRow, saveMembership, saveUser } from '@/lib/store/club-repository';
import { createServiceSupabase } from '@/lib/supabase/server';
import { UserRole } from '@/types/domain';

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

/** Counts remaining administrators, excluding one user by id. */
function otherAdmins(exceptId: string) {
  return getPlatformStore().users.filter(
    (u) => u.id !== exceptId && isAdminRole(u.role)
  ).length;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const store = getPlatformStore();
    const user = store.users.find((u) => u.id === id);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });
    }

    const nextRole = body.role as UserRole | undefined;
    const nextClubId = body.clubId as string | null | undefined;
    const nextSchoolId = body.schoolId as string | null | undefined;

    if (nextRole !== undefined) {
      if (!ASSIGNABLE_ROLES.includes(nextRole)) {
        return NextResponse.json({ ok: false, error: 'Unknown role.' }, { status: 422 });
      }
      // Never leave the platform without an administrator.
      if (isAdminRole(user.role) && !isAdminRole(nextRole) && otherAdmins(user.id) === 0) {
        return NextResponse.json(
          { ok: false, error: 'This is the last administrator. Promote someone else first.' },
          { status: 409 }
        );
      }
      user.role = nextRole;
    }

    if (nextSchoolId !== undefined) {
      if (nextSchoolId === null || nextSchoolId === '') {
        user.school_id = null;
        user.school_name = undefined;
        user.school_code = undefined;
        user.club_id = null;
        user.club_name = undefined;
      } else {
        const school = store.schools.find((s) => s.id === nextSchoolId);
        if (!school) {
          return NextResponse.json({ ok: false, error: 'School not found.' }, { status: 422 });
        }
        const club = store.clubs.find((c) => c.school_id === school.id);
        user.school_id = school.id;
        user.school_name = school.name;
        user.school_code = school.code;
        user.club_id = club?.id ?? null;
        user.club_name = club?.name;
      }
    }

    if (nextClubId !== undefined) {
      // Moving a person into a club also moves them into that club's school.
      assignUserToClub(user.id, nextClubId === '' ? null : nextClubId);
      await saveMembership(user.id, user.club_id ?? null);
    }

    // Best-effort metadata sync so the auth account reflects the role.
    const supabase = createServiceSupabase();
    if (supabase && user.auth_user_id) {
      try {
        await supabase.auth.admin.updateUserById(user.auth_user_id, {
          user_metadata: { full_name: user.full_name, role: user.role },
        });
      } catch {
        // Store remains authoritative for in-app authorisation.
      }
    }

    await saveUser(user);

    return NextResponse.json({ ok: true, user, updatedBy: actor.email });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to update user' },
      { status }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await ctx.params;

    const store = getPlatformStore();
    const index = store.users.findIndex((u) => u.id === id);
    if (index === -1) {
      return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });
    }

    const user = store.users[index];

    if (user.id === actor.id || user.auth_user_id === actor.auth_user_id) {
      return NextResponse.json({ ok: false, error: 'You cannot delete your own account.' }, { status: 409 });
    }
    if (isAdminRole(user.role) && otherAdmins(user.id) === 0) {
      return NextResponse.json(
        { ok: false, error: 'This is the last administrator and cannot be deleted.' },
        { status: 409 }
      );
    }

    // Remove the sign-in account first; if that fails, keep the profile so the
    // two records cannot drift apart.
    const supabase = createServiceSupabase();
    if (supabase && user.auth_user_id) {
      const { error } = await supabase.auth.admin.deleteUser(user.auth_user_id);
      if (error) {
        return NextResponse.json(
          { ok: false, error: `Could not delete the sign-in account: ${error.message}` },
          { status: 422 }
        );
      }
    }

    store.users.splice(index, 1);
    await deleteUserRow(user.id);

    return NextResponse.json({
      ok: true,
      deleted: { id: user.id, email: user.email },
      deletedBy: actor.email,
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to delete user' },
      { status }
    );
  }
}
