import { NextRequest, NextResponse } from 'next/server';
import { AuthError, requireSuperAdmin } from '@/lib/auth/guards';
import { getPlatformStore } from '@/lib/store/platform-store';
import { createServiceSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    const store = getPlatformStore();
    const user = store.users.find((u) => u.id === id || u.auth_user_id === id);

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });
    }
    if (!user.auth_user_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'This profile has no sign-in account yet. Create one with a password first, then reset it here.',
        },
        { status: 422 }
      );
    }
    if (newPassword && newPassword.length < 8) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 8 characters.' },
        { status: 422 }
      );
    }

    const supabase = createServiceSupabase();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' },
        { status: 503 }
      );
    }

    // Explicit password set (admin-assisted reset)
    if (newPassword) {
      const { error } = await supabase.auth.admin.updateUserById(user.auth_user_id, {
        password: newPassword,
      });
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
      }
      return NextResponse.json({
        ok: true,
        mode: 'set',
        message: `Password updated for ${user.email}.`,
        actor: actor.email,
      });
    }

    // Otherwise issue a one-time recovery link the admin can hand over.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      mode: 'link',
      message: `Recovery link generated for ${user.email}. Share it privately — it expires shortly.`,
      link: data?.properties?.action_link ?? null,
      actor: actor.email,
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Password reset failed' },
      { status }
    );
  }
}
