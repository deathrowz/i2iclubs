import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSignedInProfile } from '@/lib/auth/guards';
import { recordActivity } from '@/lib/store/platform-store';

export const dynamic = 'force-dynamic';

/**
 * Records that the signed-in user is active now. Called once per visit from the
 * client so the admin console can report "last seen" and hours on platform.
 *
 * Deliberately permissive: this is telemetry, not an authorisation decision, so
 * it also accepts the legacy platform cookie used by the static build.
 */
export async function POST() {
  try {
    let profile = await getSignedInProfile();

    if (!profile) {
      const cookieStore = await cookies();
      const legacyId =
        cookieStore.get('i2i_auth_user_id')?.value ?? cookieStore.get('haritha_auth_user_id')?.value;
      if (legacyId) {
        const { getPlatformStore } = await import('@/lib/store/platform-store');
        profile = getPlatformStore().users.find((u) => u.id === legacyId) ?? null;
      }
    }

    if (!profile) return new NextResponse(null, { status: 204 });

    await recordActivity(profile.id);
    return NextResponse.json({ ok: true });
  } catch {
    // Never let telemetry break a page load.
    return new NextResponse(null, { status: 204 });
  }
}
