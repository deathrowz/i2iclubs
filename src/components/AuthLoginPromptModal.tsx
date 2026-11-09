'use client';

import React, { useState } from 'react';
import {
  KeyRound,
  Lock,
  Recycle,
  ShieldCheck,
  X,
} from 'lucide-react';
import { UserProfile } from '@/types/domain';
import { getSupabaseSessionClient } from '@/lib/supabase/client';
import { resolveLoginIdentifier } from '@/lib/client/auth-bridge';

interface AuthLoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  activeUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  promptReason?: string | null;
}

export function AuthLoginPromptModal({
  isOpen,
  onClose,
  users,
  activeUser,
  onSelectUser,
  promptReason,
}: AuthLoginPromptModalProps) {
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = loginInput.trim().toLowerCase();
    if (!clean) {
      setErrorMessage('Please enter your Login ID, Email address, or registered Phone number.');
      return;
    }
    if (!passwordInput.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Resolve the typed identifier on the server; the browser does not hold the user list.
      let match: UserProfile | undefined =
        (await resolveLoginIdentifier(clean)) ?? undefined;

      // Attempt Supabase Auth verification
      const targetEmail = match ? match.email : (clean.includes('@') ? clean : null);
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

            if (!match) {
              try {
                const { data: dbProfile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('auth_user_id', authData.user.id)
                  .single();

                if (dbProfile) {
                  match = {
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
                  match = {
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
                match = {
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
          // Fall through to local verification
        }
      }

      const isValidPassword = supabaseAuthenticated;

      if (!match || !isValidPassword) {
        setErrorMessage('Invalid credentials. Please verify your Email or Login ID and password.');
        setIsSubmitting(false);
        return;
      }

      setErrorMessage(null);
      onSelectUser(match);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111010]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#FFFFFF] rounded-2xl border border-[#111010]/15 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#005FA3] text-white p-5 sm:p-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#9CF2F2] text-xs font-mono font-bold uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              <span>I2I Clubs (Idea2Impact) • Authentication Gateway</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mt-1">
              Sign In to Your Account
            </h2>
            <p className="text-xs text-[#E6F1FA]/85 mt-1 max-w-sm">
              {promptReason ||
                'Access role-specific features across school verification queues and expert evaluation ledgers.'}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full hover:bg-white/10 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 bg-[#FAFBFB]">
          <form onSubmit={handleManualLogin} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 leading-relaxed">
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-[#111010] uppercase tracking-wider text-[11px]">
                Login ID or Email
              </label>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => {
                  setLoginInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. budhikka.gunasekera@giz.de, auditor.giz@giz.de, student.lead@i2iclubs.lk or SCH-01-TEACHER"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#111010]/20 bg-white text-xs font-semibold text-[#111010] placeholder:text-[#111010]/40 focus:border-[#005FA3] focus:ring-2 focus:ring-[#005FA3]/15 outline-none transition"
                autoFocus
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-[#111010] uppercase tracking-wider text-[11px]">
                Password
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#111010]/20 bg-white text-xs font-semibold text-[#111010] placeholder:text-[#111010]/40 focus:border-[#005FA3] focus:ring-2 focus:ring-[#005FA3]/15 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#005FA3] text-white hover:bg-[#0B3E6E] transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Recycle className="w-4 h-4 animate-spin text-[#9CF2F2]" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Authenticate &amp; Open Dashboard →</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-[#FFFFFF] border-t border-[#111010]/12 px-6 py-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-[#005FA3] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero-Trust RBAC Secured</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#111010]/70 hover:bg-[#F0F3F5] transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
