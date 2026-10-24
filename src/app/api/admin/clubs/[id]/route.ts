import { NextRequest, NextResponse } from 'next/server';
import { AuthError, requireSuperAdmin } from '@/lib/auth/guards';
import { deleteSchoolClub, updateSchoolClub } from '@/lib/store/platform-store';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const club = updateSchoolClub(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      tagline: typeof body.tagline === 'string' ? body.tagline : undefined,
      circularSector: typeof body.circularSector === 'string' ? body.circularSector : undefined,
      schoolId: typeof body.schoolId === 'string' ? body.schoolId : undefined,
    });

    return NextResponse.json({ ok: true, club, updatedBy: actor.email });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 422;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Could not update the club' },
      { status }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await ctx.params;

    const result = deleteSchoolClub(id);
    return NextResponse.json({ ok: true, ...result, deletedBy: actor.email });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 422;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Could not delete the club' },
      { status }
    );
  }
}
