import { NextRequest, NextResponse } from 'next/server';
import { ensureClubsHydrated } from '@/lib/store/club-repository';
import {
  getFullPlatformSnapshot,
  performExpertAdjudication,
  performTeacherReview,
  updateGamificationConfig,
} from '@/lib/store/platform-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Reflect clubs persisted in Postgres rather than only the built-in seeds.
  await ensureClubsHydrated();
  const snapshot = getFullPlatformSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
