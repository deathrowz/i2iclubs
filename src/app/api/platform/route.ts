import { NextRequest, NextResponse } from 'next/server';
import { ensureStoreHydrated } from '@/lib/store/club-repository';
import { getSignedInProfile } from '@/lib/auth/guards';
import { bindActor } from '@/lib/auth/scope';
import { toPublicSnapshot } from '@/lib/auth/identity';
import {
  getFullPlatformSnapshot,
  performExpertAdjudication,
  performTeacherReview,
  updateGamificationConfig,
} from '@/lib/store/platform-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Reflect clubs persisted in Postgres rather than only the built-in seeds.
  await ensureStoreHydrated();
  const snapshot = getFullPlatformSnapshot();

  // Anonymous callers get the public view: no contact details, student
  // identities, proof-file locations or message history. Signed-in callers get
  // the full snapshot, which the admin console needs.
  const profile = await getSignedInProfile();
  const body = profile ? snapshot : toPublicSnapshot(snapshot);

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  // Every mutation is attributed to the verified Supabase session. The
  // `actorId` in the body is ignored: it was previously trusted, which let any
  // caller act as any user whose id the public snapshot disclosed.
  const profile = await getSignedInProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'Sign in required.' }, { status: 401 });
  }

  try {
    const body = bindActor(await req.json(), profile);
    const { actionType } = body;

    if (actionType === 'TEACHER_REVIEW') {
      const result = await performTeacherReview({
        actorId: body.actorId,
        logId: body.logId,
        decision: body.decision,
        notesOrReason: body.notesOrReason,
        forceRandomAuditSelection: body.forceRandomAuditSelection,
      });
      return NextResponse.json({
        ok: true,
        result,
        snapshot: getFullPlatformSnapshot(),
      });
    }

    if (actionType === 'EXPERT_ADJUDICATION') {
      const result = await performExpertAdjudication({
        actorId: body.actorId,
        logId: body.logId,
        action: body.action,
        criteriaScores: body.criteriaScores,
        notesOrReason: body.notesOrReason,
      });
      return NextResponse.json({
        ok: true,
        result,
        snapshot: getFullPlatformSnapshot(),
      });
    }

    if (actionType === 'UPDATE_GAMIFICATION_CONFIG') {
      const config = updateGamificationConfig({
        actorId: body.actorId,
        updates: body.updates,
      });
      return NextResponse.json({
        ok: true,
        config,
        snapshot: getFullPlatformSnapshot(),
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown actionType: ${actionType}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Operation failed',
      },
      { status: 403 }
    );
  }
}
