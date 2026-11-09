import { NextRequest, NextResponse } from 'next/server';
import { ensureStoreHydrated } from '@/lib/store/club-repository';
import { getPlatformStore } from '@/lib/store/platform-store';
import { matchesLoginIdentifier } from '@/lib/auth/identity';

export const dynamic = 'force-dynamic';

/**
 * Maps a typed sign-in identifier (email, login code, phone, school code) to
 * the account's email, which the browser needs to call Supabase Auth.
 *
 * Login codes and phone numbers are not public, so this is the only place they
 * are matched. Returns `profile: null` for no match. Nothing else is revealed.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const identifier =
    typeof body?.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';

  if (!identifier || identifier.length > 200) {
    return NextResponse.json({ ok: true, profile: null }, { headers: { 'Cache-Control': 'no-store' } });
  }

  await ensureStoreHydrated();
  const user = getPlatformStore().users.find((u) => matchesLoginIdentifier(u, identifier));

  const profile = user
    ? {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        school_id: user.school_id,
        club_id: user.club_id,
      }
    : null;

  return NextResponse.json({ ok: true, profile }, { headers: { 'Cache-Control': 'no-store' } });
}
