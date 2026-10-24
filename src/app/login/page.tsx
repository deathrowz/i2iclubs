'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Recycle, AlertCircle, CheckCircle2, KeyRound, LogIn } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { RoleLoginPortalView } from '@/components/RoleLoginPortalView';
import { fetchPlatformSnapshotClient } from '@/lib/client/platform-bridge';
import { UserProfile } from '@/types/domain';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('returnUrl') || searchParams?.get('redirectTo');

  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info' | 'success'; text: string } | null>(null);
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');

  // Resolve Supabase config at runtime — NEXT_PUBLIC_* values are inlined at
  // build time, which the production Docker build never receives.
  const [supabase, setSupabase] = useState<any | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((cfg) => {
        if (cancelled) return;
        if (cfg?.supabaseUrl && cfg?.supabaseAnonKey) {
          setSupabase(createBrowserClient(cfg.supabaseUrl, cfg.supabaseAnonKey));
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const AUTH_ENABLED = Boolean(supabase);

  useEffect(() => {
    fetchPlatformSnapshotClient().then(setSnapshot);
  }, []);

  const routeForRole = (role?: string) => {
    if (role === 'student') return '/dashboard/student';
    if (role === 'teacher') return '/dashboard/teacher';
    if (role === 'expert_admin' || role === 'expert') return '/dashboard/expert';
    return '/';
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setBusy(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setBusy(false);
      setMessage({ kind: 'error', text: error.message });
      return;
    }

    const signedInEmail = data.user?.email?.toLowerCase() ?? '';
    const profile: UserProfile | undefined = snapshot?.users?.find(
      (u: UserProfile) => u.email.toLowerCase() === signedInEmail
    );

    // Mirror the session for the client-side platform views.
    if (typeof window !== 'undefined' && profile) {
      localStorage.setItem('i2i_auth_user_id', profile.id);
      document.cookie = `i2i_auth_user_id=${profile.id}; path=/; max-age=2592000; SameSite=Lax`;
    }

    setBusy(false);

    if (redirectTo && redirectTo.startsWith('/')) {
      router.push(redirectTo);
    } else if (profile?.role === 'super_admin' || profile?.role === 'admin') {
      router.push('/admin');
    } else {
      router.push(routeForRole(profile?.role));
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setBusy(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
    });

    setBusy(false);
    setMessage({
      kind: error ? 'error' : 'success',
      text: error
        ? error.message
        : 'If that email has an account, a reset link is on its way. Check your inbox.',
    });
  };

  if (!snapshot || !authChecked) {
    return (
      <div className="min-h-screen bg-[#E6F1FA] flex items-center justify-center p-6">
        <div className="hai-card px-6 py-4 flex items-center gap-3 text-[#005FA3] font-semibold text-sm shadow-xs">
          <Recycle className="w-5 h-5 animate-spin" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  // Static / demo build with no auth backend — keep the persona portal.
  if (!AUTH_ENABLED) {
    const handleSelectUserAndNavigate = (userId: string) => {
      const matched = snapshot.users.find((u: UserProfile) => u.id === userId || u.auth_user_id === userId);
      if (typeof document !== 'undefined') {
        document.cookie = `i2i_auth_user_id=${userId}; path=/; max-age=2592000; SameSite=Lax`;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('i2i_auth_user_id', userId);
      }
      if (redirectTo && redirectTo.startsWith('/')) {
        router.push(redirectTo);
      } else if (matched?.role === 'super_admin' || matched?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push(routeForRole(matched?.role));
      }
    };

    return (
      <div className="min-h-screen bg-[#E6F1FA] p-4 sm:p-8">
        <div className="max-w-[1240px] mx-auto">
          <RoleLoginPortalView
            activeUser={snapshot.users[0]}
            users={snapshot.users}
            leaderboard={snapshot.leaderboard}
            config={snapshot.gamificationConfig}
            onSelectUserAndNavigate={handleSelectUserAndNavigate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E6F1FA] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-[12px_12px_12px_3px] bg-[#005FA3] text-[#9CF2F2] flex items-center justify-center">
            <Recycle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-bold text-[#111010] font-[var(--font-jakarta)] leading-none">
              I2I Clubs
            </div>
            <div className="text-xs text-[#111010]/65 mt-1">Idea2Impact • Sri Lanka</div>
          </div>
        </div>

        <div className="hai-card p-7">
          <h1 className="text-xl font-bold text-[#111010] font-[var(--font-jakarta)]">
            {mode === 'signin' ? 'Sign in' : 'Reset your password'}
          </h1>
          <p className="text-sm text-[#111010]/70 mt-1">
            {mode === 'signin'
              ? 'Use the email and password provided by your school or programme administrator.'
              : 'Enter your email and we will send you a reset link.'}
          </p>

          {message && (
            <div
              className={`mt-4 rounded-xl border p-3 text-sm flex items-start gap-2 ${
                message.kind === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : message.kind === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-[#E6F1FA] border-[#005FA3]/20 text-[#005FA3]'
              }`}
            >
              {message.kind === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={mode === 'signin' ? handleSignIn : handleForgot} className="mt-5 space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-[#111010] mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full hai-input px-3.5 py-2.5 text-sm"
                placeholder="you@school.lk"
              />
            </div>

            {mode === 'signin' && (
              <div>
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[#111010] mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full hai-input px-3.5 py-2.5 text-sm"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full hai-btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? (
                <Recycle className="w-4 h-4 animate-spin" />
              ) : mode === 'signin' ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              <span>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Send reset link'}</span>
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'forgot' : 'signin');
                setMessage(null);
              }}
              className="text-xs font-semibold text-[#005FA3] hover:underline"
            >
              {mode === 'signin' ? 'Forgot your password?' : 'Back to sign in'}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-[#111010]/50 mt-5">
          Accounts are issued by the programme administrator. Contact them if you need access.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#E6F1FA] flex items-center justify-center">
          <Recycle className="w-6 h-6 text-[#005FA3] animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
