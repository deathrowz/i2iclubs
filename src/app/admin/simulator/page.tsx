'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Code2,
  Phone,
  Recycle,
  Server,
  Shield,
  Terminal,
} from 'lucide-react';
import {
  AuditLogEntry,
  Club,
  GamificationConfig,
  HealthRiskAlert,
  ImpactLog,
  LeaderboardSchoolScore,
  School,
  UserProfile,
  WhatsAppBotOutboundMessage,
} from '@/types/domain';
import { fetchPlatformSnapshotClient } from '@/lib/client/platform-bridge';
import { WhatsAppCloudWorkbench } from '@/components/WhatsAppCloudWorkbench';

interface SnapshotData {
  schools: School[];
  clubs: Club[];
  users: UserProfile[];
  impactLogs: ImpactLog[];
  auditLogs: AuditLogEntry[];
  gamificationConfig: GamificationConfig;
  whatsappMessages: WhatsAppBotOutboundMessage[];
  telegramMessages?: any[];
  leaderboard: LeaderboardSchoolScore[];
  healthAlerts: HealthRiskAlert[];
}

export default function AdminSimulatorPage() {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchPlatformSnapshotClient().then((data) => {
      if (!isMounted) return;
      setSnapshot(data);
    });

    const interval = setInterval(() => {
      fetchPlatformSnapshotClient().then((data) => {
        if (!isMounted) return;
        setSnapshot(data);
      });
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="hai-card p-8 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#005FA3] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-[#111010]">
            Loading WhatsApp Webhook Simulator...
          </span>
        </div>
      </div>
    );
  }

  const adminUser =
    snapshot.users.find((u) => u.role === 'super_admin') || snapshot.users[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-[#111010]">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#111010]/15">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Link
              href="/"
              className="w-10 h-10 rounded-xl bg-[#111010] text-[#9CF2F2] flex items-center justify-center shrink-0 shadow-xs hover:opacity-90 transition"
              title="Return to Portal Home"
            >
              <Terminal className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#111010] font-[var(--font-jakarta)]">
                  I2I Clubs (Idea2Impact)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  DEVELOPER / ADMIN SIMULATOR
                </span>
              </div>
              <div className="text-[11px] font-medium text-[#111010]/65 mt-0.5">
                Stateless WhatsApp Cloud Webhook Diagnostic Environment • OCI self-hosted
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-semibold">
              <Server className="w-3.5 h-3.5 text-emerald-600" />
              <span>OCI self-hosted • Colocated Supabase</span>
            </div>

            <Link
              href="/"
              className="text-xs text-[#005FA3] font-bold hover:underline"
            >
              ← Back to Platform
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-8 pt-6 pb-16 space-y-6">
        {/* Diagnostic Eyebrow */}
        <section className="pb-4 border-b border-[#111010]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-amber-800 block">
              Diagnostic &amp; Compliance Sandbox (Isolated from School UIs)
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111010] font-[var(--font-jakarta)] mt-1">
              WhatsApp Cloud API Webhook Simulator &amp; EXIF Inspector
            </h1>
            <p className="text-xs text-[#111010]/70 mt-1">
              Simulates Meta Graph API v20.0 inbound webhook payloads, tests HMAC-SHA256 signature verification, negative tests (missing GPS / compressed photo), and unregistered phone graceful handling.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 text-[#9CF2F2] text-xs font-mono font-bold self-start sm:self-auto">
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>isDev=true • isAdmin=true</span>
          </div>
        </section>

        {/* WhatsApp Cloud Workbench with Full Admin Simulator Enabled */}
        <WhatsAppCloudWorkbench
          clubs={snapshot.clubs}
          schools={snapshot.schools}
          users={snapshot.users}
          impactLogs={snapshot.impactLogs}
          whatsappMessages={snapshot.whatsappMessages || snapshot.telegramMessages}
          activeUser={adminUser}
          isAdmin={true}
          isDev={true}
          initialRole="teacher"
          initialClubId="club-01"
          onRefreshSnapshot={setSnapshot}
          onNavigateToVerification={() => {}}
        />
      </main>
    </div>
  );
}
