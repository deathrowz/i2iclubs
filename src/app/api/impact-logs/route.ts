import { NextRequest, NextResponse } from 'next/server';
import { getSignedInProfile } from '@/lib/auth/guards';
import { bindActor, scopeImpactLogs } from '@/lib/auth/scope';
import {
  createStudentImpactSubmission,
  getFullPlatformSnapshot,
  getPlatformStore,
} from '@/lib/store/platform-store';

export const dynamic = 'force-dynamic';

/**
 * Returns the impact logs the caller may see. The role, school and club scope
 * come from the verified session, not from query parameters, which the caller
 * could set to any value.
 */
export async function GET() {
  const profile = await getSignedInProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'Sign in required.' }, { status: 401 });
  }

  const logs = scopeImpactLogs(profile, getPlatformStore().impactLogs);
  return NextResponse.json({ ok: true, impactLogs: logs });
}

export async function POST(req: NextRequest) {
  // Submissions are attributed to the verified session. The previous fallback
  // to a seeded student id meant an unauthenticated POST was filed under a real
  // account.
  const profile = await getSignedInProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'Sign in required.' }, { status: 401 });
  }

  try {
    const body = bindActor(await req.json(), profile);
    const created = await createStudentImpactSubmission({
      actorId: body.actorId,
      clubId: body.clubId || 'club-01',
      fileName: body.fileName || 'WHATSAPP_DOC.JPG',
      mimeType: body.mimeType || 'image/jpeg',
      isUncompressedDocument: Boolean(body.isUncompressedDocument),
      s3Url: body.s3Url,
      s3Key: body.s3Key,
      exifTimestamp: body.exifTimestamp,
      exifLat: Number(body.exifLat),
      exifLng: Number(body.exifLng),
      exifDeviceMake: body.exifDeviceMake,
      exifDeviceModel: body.exifDeviceModel,
      activityTitle: body.activityTitle,
      activityCategory: body.activityCategory || 'upcycled_production',
      description: body.description || '',
      wasteKg: Number(body.wasteKg),
      revenueUsd: Number(body.revenueUsd),
      isFinalPitch: Boolean(body.isFinalPitch),
      parentLogId: body.parentLogId,
    });

    return NextResponse.json({
      ok: true,
      log: created,
      snapshot: getFullPlatformSnapshot(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to create impact log',
      },
      { status: 422 }
    );
  }
}
