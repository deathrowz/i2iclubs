'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Recycle,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  GamificationConfig,
  LeaderboardSchoolScore,
  UserProfile,
} from '@/types/domain';
import { getSupabaseSessionClient } from '@/lib/supabase/client';
import { resolveLoginIdentifier } from '@/lib/client/auth-bridge';

interface RoleLoginPortalViewProps {
  activeUser: UserProfile;
  users: UserProfile[];
  leaderboard: LeaderboardSchoolScore[];
  config?: GamificationConfig;
  onSelectUserAndNavigate: (
    userId: string,
    targetTab:
      | 'student_gamified'
      | 'verification'
      | 'leaderboard'
      | 'health_risk'
      | 'login_portal'
  ) => void;
}

export function RoleLoginPortalView({
  users,
  onSelectUserAndNavigate,
}: RoleLoginPortalViewProps) {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Universal Login Handler with Real Supabase Auth & Role-Based Identity Dispatch
   */
  const handleUniversalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = loginIdentifier.trim().toLowerCase();

    if (!cleanId) {
      setErrorMessage('Please enter your Email address, Login Code, or registered Phone number.');
      return;
    }

    if (!passwordInput.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Resolve the typed identifier on the server (login codes and phone
      //    numbers are not shipped to the browser).
      let activePersona: UserProfile | undefined =
        (await resolveLoginIdentifier(cleanId)) ?? undefined;

      // 2. Attempt Supabase Auth login if email is available
      const targetEmail = activePersona ? activePersona.email : (cleanId.includes('@') ? cleanId : null);
      let supabaseAuthenticated = false;

      const supabase = getSupabaseSessionClient();
      if (supabase && targetEmail) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: passwordInput,
          });
          if (authData?.user && !authError) {
            supabaseAuthenticated = true;

            // If not found in static users, dynamically resolve from Supabase profiles
            if (!activePersona) {
              try {
                const { data: dbProfile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('auth_user_id', authData.user.id)
                  .single();

                if (dbProfile) {
                  activePersona = {
                    id: dbProfile.id,
                    auth_user_id: dbProfile.auth_user_id,
                    email: dbProfile.email || authData.user.email || targetEmail,
                    login_code: dbProfile.login_code || 'GIZ-ADMIN',
                    phone_number: dbProfile.phone_number || '',
                    organization: dbProfile.organization || 'GIZ Sri Lanka / Circular Economy Project',
                    full_name: dbProfile.full_name || (authData.user.user_metadata?.full_name as string) || 'Budhikka Gunasekera',
                    role: dbProfile.role || (authData.user.user_metadata?.role as any) || 'super_admin',
                    school_id: dbProfile.school_id || null,
                    club_id: dbProfile.club_id || null,
                  };
                } else {
                  activePersona = {
                    id: authData.user.id,
                    auth_user_id: authData.user.id,
                    email: authData.user.email || targetEmail,
                    login_code: 'GIZ-ADMIN',
                    phone_number: '',
                    organization: (authData.user.user_metadata?.organization as string) || 'GIZ Sri Lanka',
                    full_name: (authData.user.user_metadata?.full_name as string) || 'Budhikka Gunasekera',
                    role: (authData.user.user_metadata?.role as any) || 'super_admin',
                    school_id: null,
                    club_id: null,
                  };
                }
              } catch {
                activePersona = {
                  id: authData.user.id,
                  auth_user_id: authData.user.id,
                  email: authData.user.email || targetEmail,
                  login_code: 'GIZ-ADMIN',
                  phone_number: '',
                  organization: 'GIZ Sri Lanka',
                  full_name: 'Budhikka Gunasekera',
                  role: 'super_admin',
                  school_id: null,
                  club_id: null,
                };
              }
            }
          }
        } catch {
          // Ignore network / offline errors and proceed to local credential check
        }
      }

      // 3. Fallback verification: Check known secure pilot passwords if Supabase Auth is offline
      const isValidPassword = supabaseAuthenticated;

      if (!activePersona || !isValidPassword) {
        setIsSubmitting(false);
        setErrorMessage(
          'Invalid credentials. Please verify your Email or Login Code and password.'
        );
        return;
      }

      // 4. Set secure session cookies & storage for Next.js Middleware
      if (typeof document !== 'undefined') {
        const maxAge = rememberMe ? 2592000 : 86400;
        document.cookie = `i2i_auth_user_id=${activePersona.id}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `haritha_auth_user_id=; path=/; max-age=0; SameSite=Lax`;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('i2i_auth_user_id', activePersona.id);
        localStorage.removeItem('haritha_auth_user_id');
      }

      // 5. Automated Role-to-Dashboard Dispatch (Strict RBAC Routing)
      if (activePersona.role === 'student') {
        onSelectUserAndNavigate(activePersona.id, 'student_gamified');
      } else if (activePersona.role === 'teacher') {
        onSelectUserAndNavigate(activePersona.id, 'verification');
      } else if (activePersona.role === 'expert_admin' || (activePersona.role as string) === 'expert') {
        onSelectUserAndNavigate(activePersona.id, 'verification');
      } else {
        // super_admin / admin -> Lands on 15-School National Index
        onSelectUserAndNavigate(activePersona.id, 'leaderboard');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12 space-y-6 animate-in fade-in duration-300">
      {/* Brand Lockup */}
      <div className="text-center space-y-3 mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#005FA3] text-[#9CF2F2] shadow-sm mb-1">
          <Recycle className="w-8 h-8 stroke-[2.2]" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111010] font-[var(--font-jakarta)]">
            Sign In to I2I Clubs (Idea2Impact)
          </h1>
          <p className="text-xs sm:text-sm text-[#111010]/70 mt-1">
            Sri Lanka School Circular Economy Platform • GIZ National Pilot
          </p>
        </div>
      </div>

      {/* Universal Form Card */}
      <div className="hai-card p-6 sm:p-8 space-y-5 bg-[#FFFFFF] border border-[#111010]/15 shadow-sm rounded-2xl">
        <form onSubmit={handleUniversalSignIn} className="space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed animate-in fade-in duration-200">
              {errorMessage}
            </div>
          )}

          {/* Field 1: Login ID or Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="universal-login-id"
              className="block text-xs font-bold text-[#111010] uppercase tracking-wider"
            >
              Login ID or Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#111010]/40">
                <User className="w-4 h-4" />
              </div>
              <input
                id="universal-login-id"
                type="text"
                autoComplete="username"
                value={loginIdentifier}
                onChange={(e) => {
                  setLoginIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. budhikka.gunasekera@giz.de, auditor.giz@giz.de, student.lead@i2iclubs.lk or SCH-01-TEACHER"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#111010]/20 bg-[#F8FAFC] text-xs font-semibold text-[#111010] placeholder:text-[#111010]/40 focus:bg-white focus:border-[#005FA3] focus:ring-2 focus:ring-[#005FA3]/15 outline-none transition"
              />
            </div>
            <p className="text-[11px] text-[#111010]/55">
              Enter your assigned institutional email address or school login ID.
            </p>
          </div>

          {/* Field 2: Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="universal-password"
              className="block text-xs font-bold text-[#111010] uppercase tracking-wider"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#111010]/40">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="universal-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#111010]/20 bg-[#F8FAFC] text-xs font-semibold text-[#111010] placeholder:text-[#111010]/40 focus:bg-white focus:border-[#005FA3] focus:ring-2 focus:ring-[#005FA3]/15 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#111010]/40 hover:text-[#111010] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Security Notice */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[#111010]/75">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-[#111010]/30 text-[#005FA3] focus:ring-[#005FA3] w-3.5 h-3.5 cursor-pointer"
              />
              <span>Remember session</span>
            </label>

            <div className="flex items-center gap-1 text-[11px] text-[#005FA3] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Supabase Zero-Trust</span>
            </div>
          </div>

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-[#005FA3] text-white hover:bg-[#0B3E6E] active:scale-[0.99] transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
          >
            {isSubmitting ? (
              <>
                <Recycle className="w-4 h-4 animate-spin text-[#9CF2F2]" />
                <span>Authenticating &amp; Routing...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Zero-Trust Institutional Security Notice */}
        <div className="pt-4 border-t border-[#111010]/10 text-center text-xs text-[#111010]/65 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#005FA3]" />
          <span>Zero-Trust Security • Authenticate with role credentials to access school dashboards</span>
        </div>
      </div>
    </div>
  );
}
