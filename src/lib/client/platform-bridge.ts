import {
  createStudentImpactSubmission,
  getFullPlatformSnapshot,
  getPlatformStore,
  performExpertAdjudication,
  performTeacherReview,
  updateGamificationConfig,
} from '@/lib/store/platform-store';
import { ActivityCategory } from '@/types/domain';
import {
  handleWhatsAppCloudUpdate,
  IncomingWhatsAppUpdate,
} from '@/lib/whatsapp/handler';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  computeSchoolLeaderboard,
  detectHealthAndRiskAnomalies,
} from '@/lib/gamification/engine';

/**
 * Isomorphic Platform Bridge:
 * - In full-stack server environments (Next.js dev/start, OCI Docker), calls `/api/platform` & `/api/webhook/whatsapp`.
 * - In static export environments (GitHub Pages `output: 'export'`), falls back seamlessly to the isomorphic in-browser platform engine.
 * - Always merges real-time records from Supabase PostgreSQL (e.g. newly uploaded WhatsApp Cloud API submissions).
 */
export async function fetchPlatformSnapshotClient() {
  let snapshot = getFullPlatformSnapshot();
  try {
    const res = await fetch('/api/platform');
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      snapshot = await res.json();
    }
  } catch {
    // Static export mode (GitHub Pages) fallback
  }

  // Live Supabase Sync: Fetch any real-time logs from Supabase
  try {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data: dbLogs, error } = await supabase
        .from('impact_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(dbLogs) && dbLogs.length > 0) {
        const dbLogMap = new Map(dbLogs.map((l: any) => [l.id, l]));

        // Merge DB logs with base logs (DB logs take precedence)
        const mergedLogs = [
          ...dbLogs.map((l: any) => ({
            ...l,
            parent_log_id: l.resubmission_parent_log_id || l.parent_log_id,
            verified_documents: l.verified_documents || [],
            waste_kg: Number(l.waste_kg ?? 0),
            revenue_usd: Number(l.revenue_usd ?? 0),
            co2_saved_kg: Number(l.co2_saved_kg ?? 0),
            points_awarded: Number(l.points_awarded ?? 0),
            penalty_points: Number(l.penalty_points ?? 0),
            campus_distance_meters: Number(l.campus_distance_meters ?? 0),
          })),
          ...snapshot.impactLogs.filter((l) => !dbLogMap.has(l.id)),
        ];

        // Hydrate singleton in-memory platform store
        getPlatformStore().impactLogs = mergedLogs;

        const updatedLeaderboard = computeSchoolLeaderboard({
          schools: snapshot.schools,
          clubs: snapshot.clubs,
          impactLogs: mergedLogs,
          config: snapshot.gamificationConfig,
        });

        const updatedHealthAlerts = detectHealthAndRiskAnomalies({
          schools: snapshot.schools,
          clubs: snapshot.clubs,
          impactLogs: mergedLogs,
        });

        snapshot = {
          ...snapshot,
          impactLogs: mergedLogs,
          leaderboard: updatedLeaderboard,
          healthAlerts: updatedHealthAlerts,
        };
      }
    }
  } catch (err) {
    console.warn('Live Supabase synchronization error:', err);
  }

  return snapshot;
}

export async function postPlatformActionClient(body: Record<string, any>): Promise<{
  resOk: boolean;
  data: any;
}> {
  try {
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      return { resOk: res.ok, data };
    }
  } catch {
    // Static export mode (GitHub Pages) fallback
  }

  try {
    const { actionType } = body;
    if (actionType === 'TEACHER_REVIEW') {
      const result = await performTeacherReview({
        actorId: body.actorId,
        logId: body.logId,
        decision: body.decision,
        notesOrReason: body.notesOrReason,
        forceRandomAuditSelection: body.forceRandomAuditSelection,
      });
      const freshSnapshot = await fetchPlatformSnapshotClient();
      return {
        resOk: true,
        data: { ok: true, result, snapshot: freshSnapshot },
      };
    }

    if (actionType === 'EXPERT_ADJUDICATION') {
      const result = await performExpertAdjudication({
        actorId: body.actorId,
        logId: body.logId,
        action: body.action,
        criteriaScores: body.criteriaScores,
        notesOrReason: body.notesOrReason,
      });
      const freshSnapshot = await fetchPlatformSnapshotClient();
      return {
        resOk: true,
        data: { ok: true, result, snapshot: freshSnapshot },
      };
    }

    if (actionType === 'UPDATE_GAMIFICATION_CONFIG') {
      const config = updateGamificationConfig({
        actorId: body.actorId,
        updates: body.updates,
      });
      const freshSnapshot = await fetchPlatformSnapshotClient();
      return {
        resOk: true,
        data: { ok: true, config, snapshot: freshSnapshot },
      };
    }

    return {
      resOk: false,
      data: { ok: false, error: `Unknown actionType: ${actionType}` },
    };
  } catch (err) {
    return {
      resOk: false,
      data: {
        ok: false,
        error: err instanceof Error ? err.message : 'Operation failed',
      },
    };
  }
}

export async function postWhatsAppWebhookClient(body: Record<string, any>) {
  try {
    const res = await fetch('/api/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.headers.get('content-type')?.includes('application/json')) {
      return await res.json();
    }
  } catch {
    // Static export mode (GitHub Pages) fallback
  }

  try {
    const result = await handleWhatsAppCloudUpdate(body as IncomingWhatsAppUpdate);
    return {
      ...result,
      snapshot: getFullPlatformSnapshot(),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'WhatsApp Cloud API webhook processing error',
    };
  }
}

/**
 * @deprecated Use `postWhatsAppWebhookClient`
 */
export const postTelegramWebhookClient = postWhatsAppWebhookClient;

export async function postStudentImpactSubmissionClient(body: {
  actorId: string;
  clubId: string;
  fileName: string;
  mimeType: string;
  isUncompressedDocument: boolean;
  s3Url?: string;
  s3Key?: string;
  exifTimestamp: string;
  exifLat: number;
  exifLng: number;
  exifDeviceMake?: string;
  exifDeviceModel?: string;
  activityTitle: string;
  activityCategory: ActivityCategory;
  description: string;
  wasteKg: number;
  revenueUsd: number;
  isFinalPitch?: boolean;
  parentLogId?: string;
}): Promise<{ resOk: boolean; data: any }> {
  try {
    const res = await fetch('/api/impact-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      return { resOk: res.ok, data };
    }
  } catch {
    // Static export mode fallback
  }

  try {
    const created = await createStudentImpactSubmission(body as any);
    const freshSnapshot = await fetchPlatformSnapshotClient();
    return {
      resOk: true,
      data: { ok: true, log: created, snapshot: freshSnapshot },
    };
  } catch (err) {
    return {
      resOk: false,
      data: {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to submit impact log',
      },
    };
  }
}

