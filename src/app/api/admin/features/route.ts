import { NextRequest, NextResponse } from 'next/server';
import { AuthError, requireAdmin, requireSuperAdmin } from '@/lib/auth/guards';
import { FEATURE_LABELS, getFeatures, hydrateFeatures, updateFeatures } from '@/lib/admin/features';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const features = await hydrateFeatures();
    return NextResponse.json({ ok: true, features, labels: FEATURE_LABELS });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to load features' },
      { status }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = await req.json();
    const allowed = Object.keys(FEATURE_LABELS);
    const patch: Record<string, boolean> = {};

    for (const key of allowed) {
      if (typeof body[key] === 'boolean') patch[key] = body[key];
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid feature changes supplied.' }, { status: 422 });
    }

    const features = await updateFeatures(patch, actor.email);
    return NextResponse.json({ ok: true, features });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to update features' },
      { status }
    );
  }
}
