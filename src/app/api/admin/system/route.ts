import { NextResponse } from 'next/server';
import { AuthError, requireAdmin } from '@/lib/auth/guards';
import { getSupabaseUrl, createServiceSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Infrastructure and service status. This is the ONLY place these technical
 * details are surfaced — they were removed from the student/teacher/expert UI.
 */
export async function GET() {
  try {
    await requireAdmin();

    const supabase = createServiceSupabase();

    let database: { reachable: boolean; detail: string } = {
      reachable: false,
      detail: 'Service role key not configured.',
    };

    if (supabase) {
      try {
        const started = Date.now();
        const { error } = await supabase.from('schools').select('id').limit(1);
        database = error
          ? { reachable: false, detail: error.message }
          : { reachable: true, detail: `Responded in ${Date.now() - started}ms` };
      } catch (e) {
        database = { reachable: false, detail: e instanceof Error ? e.message : 'Unreachable' };
      }
    }

    return NextResponse.json({
      ok: true,
      system: {
        app: {
          url: process.env.NEXT_PUBLIC_APP_URL || 'not configured',
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
        },
        data: {
          supabaseUrl: getSupabaseUrl(),
          storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'i2i-proofs',
          serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          database,
        },
        whatsapp: {
          verifyTokenConfigured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
          accessTokenConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
          appSecretConfigured: Boolean(process.env.WHATSAPP_APP_SECRET),
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? 'configured' : 'not configured',
          webhookPath: '/api/webhook/whatsapp',
        },
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to load system status' },
      { status }
    );
  }
}
