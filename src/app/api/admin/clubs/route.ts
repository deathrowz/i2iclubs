import { NextRequest, NextResponse } from 'next/server';
import { AuthError, requireAdmin, requireSuperAdmin } from '@/lib/auth/guards';
import {
  createSchoolClub,
  getPlatformStore,
  getUserActivitySummaries,
} from '@/lib/store/platform-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const store = getPlatformStore();
    const activity = getUserActivitySummaries();

    const clubs = store.clubs.map((club) => {
      const members = store.users
        .filter((u) => u.club_id === club.id)
        .map((u) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          role: u.role,
          hasPassword: Boolean(u.auth_user_id),
          lastSeenAt: activity[u.id]?.lastSeenAt ?? null,
          hoursLast7Days: activity[u.id]?.hoursLast7Days ?? 0,
        }));

      const newestSeen = members.reduce<string | null>(
        (latest, m) => (m.lastSeenAt && (!latest || m.lastSeenAt > latest) ? m.lastSeenAt : latest),
        null
      );

      return {
        id: club.id,
        name: club.name,
        slug: club.slug,
        tagline: club.tagline,
        circular_sector: club.circular_sector,
        school_id: club.school_id,
        school_name: club.school_name,
        school_code: club.school_code,
        last_submission_at: club.last_submission_at,
        memberCount: members.length,
        members,
        lastSeenAt: newestSeen,
      };
    });

    return NextResponse.json({
      ok: true,
      clubs,
      schools: store.schools.map((s) => ({ id: s.id, code: s.code, name: s.name })),
      unassigned: store.users.filter((u) => !u.club_id).length,
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to load clubs' },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = await req.json().catch(() => ({}));

    const club = createSchoolClub({
      schoolId: String(body.schoolId ?? ''),
      name: String(body.name ?? ''),
      tagline: body.tagline ? String(body.tagline) : undefined,
      circularSector: body.circularSector ? String(body.circularSector) : undefined,
      actorId: actor.id,
    });

    return NextResponse.json({ ok: true, club, createdBy: actor.email });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 422;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Could not create the club' },
      { status }
    );
  }
}
