import { NextResponse } from 'next/server';
import { AuthError, requireAdmin } from '@/lib/auth/guards';
import { getFullPlatformSnapshot } from '@/lib/store/platform-store';
import { ensureStoreHydrated } from '@/lib/store/club-repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    await ensureStoreHydrated();

    const snapshot = getFullPlatformSnapshot();
    const { users, schools, clubs, impactLogs, auditLogs, healthAlerts } = snapshot;

    const countByRole = users.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    }, {});

    const byStatus = impactLogs.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    const approved = impactLogs.filter((l) => l.status === 'approved');
    const pendingTeacher = impactLogs.filter(
      (l) => l.status === 'pending' || l.status === 'flagged'
    ).length;
    const pendingExpert = impactLogs.filter(
      (l) => l.status === 'pending_expert_review' || l.audit_status === 'pending_audit'
    ).length;
    const fraudCount = impactLogs.filter((l) => l.audit_flagged_fraud).length;

    // Submissions per day for the last 14 days
    const days: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        count: impactLogs.filter((l) => String(l.created_at).slice(0, 10) === key).length,
      });
    }

    return NextResponse.json({
      ok: true,
      metrics: {
        totals: {
          schools: schools.length,
          clubs: clubs.length,
          users: users.length,
          submissions: impactLogs.length,
          auditEntries: auditLogs.length,
          healthAlerts: healthAlerts.length,
        },
        usersByRole: countByRole,
        submissionsByStatus: byStatus,
        verified: {
          wasteKg: Number(approved.reduce((s, l) => s + Number(l.waste_kg || 0), 0).toFixed(1)),
          revenueUsd: Number(approved.reduce((s, l) => s + Number(l.revenue_usd || 0), 0).toFixed(2)),
          co2Kg: Number(approved.reduce((s, l) => s + Number(l.co2_saved_kg || 0), 0).toFixed(1)),
        },
        queues: {
          pendingTeacher,
          pendingExpert,
          fraud: fraudCount,
        },
        activity: days,
      },
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to load metrics' },
      { status }
    );
  }
}
