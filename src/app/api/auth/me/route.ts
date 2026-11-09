import { NextResponse } from 'next/server';
import { getSignedInProfile } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** The signed-in caller's own profile, from the verified Supabase session. */
export async function GET() {
  const profile = await getSignedInProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'Sign in required.' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, profile }, { headers: { 'Cache-Control': 'no-store' } });
}
