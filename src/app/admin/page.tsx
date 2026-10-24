'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Users,
} from 'lucide-react';

type Tab = 'overview' | 'users' | 'features' | 'system';

interface Metrics {
  totals: {
    schools: number;
    clubs: number;
    users: number;
    submissions: number;
    auditEntries: number;
    healthAlerts: number;
  };
  usersByRole: Record<string, number>;
  submissionsByStatus: Record<string, number>;
  verified: { wasteKg: number; revenueUsd: number; co2Kg: number };
  queues: { pendingTeacher: number; pendingExpert: number; fraud: number };
  activity: { date: string; count: number }[];
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  login_code?: string;
  school_code?: string;
  hasPassword: boolean;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json as T;
}

export default function SuperAdminConsole() {
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  if (error) {
    return (
      <div className="min-h-screen bg-[#E6F1FA] flex items-center justify-center p-6">
        <div className="hai-card p-8 max-w-md text-center space-y-3">
          <Lock className="w-8 h-8 text-[#005FA3] mx-auto" />
          <h1 className="text-lg font-bold text-[#111010] font-[var(--font-jakarta)]">
            Administrator sign-in required
          </h1>
          <p className="text-sm text-[#111010]/70">{error}</p>
          <Link href="/login?returnUrl=/admin" className="hai-btn-primary inline-block px-5 py-2.5 text-sm">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E6F1FA]">
      <header className="bg-[#005FA3] text-white">
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px_10px_10px_2px] bg-[#9CF2F2] text-[#005FA3] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold leading-none">Platform Management</div>
              <div className="text-[11px] text-[#9CF2F2] mt-0.5">Super administrator console</div>
            </div>
          </div>
          <Link href="/" className="text-xs font-semibold text-[#9CF2F2] hover:text-white">
            ← Back to platform
          </Link>
        </div>

        <div className="max-w-[1280px] mx-auto px-6 flex gap-1">
          {[
            { id: 'overview' as Tab, label: 'Overview', icon: BarChart3 },
            { id: 'users' as Tab, label: 'Users & access', icon: Users },
            { id: 'features' as Tab, label: 'Features', icon: Settings2 },
            { id: 'system' as Tab, label: 'System', icon: Server },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-lg flex items-center gap-1.5 transition ${
                tab === id ? 'bg-[#E6F1FA] text-[#005FA3]' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto p-6 space-y-6">
        {tab === 'overview' && <Overview onError={setError} onLoaded={() => setLoading(false)} />}
        {tab === 'users' && <UsersPanel onError={setError} />}
        {tab === 'features' && <FeaturesPanel onError={setError} />}
        {tab === 'system' && <SystemPanel onError={setError} />}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- Overview */

function Overview({ onError, onLoaded }: { onError: (e: string) => void; onLoaded: () => void }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const load = useCallback(() => {
    api<{ metrics: Metrics }>('/api/admin/metrics')
      .then((r) => setMetrics(r.metrics))
      .catch((e) => onError(e.message))
      .finally(onLoaded);
  }, [onError, onLoaded]);

  useEffect(load, [load]);

  if (!metrics) return <Loading />;

  const maxActivity = Math.max(1, ...metrics.activity.map((d) => d.count));

  const cards = [
    { label: 'Schools', value: metrics.totals.schools },
    { label: 'Clubs', value: metrics.totals.clubs },
    { label: 'Users', value: metrics.totals.users },
    { label: 'Submissions', value: metrics.totals.submissions },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="hai-card p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#005FA3]">{c.label}</div>
            <div className="text-3xl font-extrabold font-mono text-[#111010] mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="hai-card p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-[#111010] mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#005FA3]" /> Submissions, last 14 days
          </h2>
          <div className="flex items-end gap-1.5 h-32">
            {metrics.activity.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                <div
                  className="w-full rounded-t bg-[#005FA3]"
                  style={{ height: `${Math.max(2, (d.count / maxActivity) * 100)}%` }}
                />
                <span className="text-[9px] text-[#111010]/50 font-mono">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hai-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-[#111010]">Review queues</h2>
          <QueueRow label="Awaiting teacher" value={metrics.queues.pendingTeacher} tone="amber" />
          <QueueRow label="Awaiting expert panel" value={metrics.queues.pendingExpert} tone="blue" />
          <QueueRow label="Fraud flagged" value={metrics.queues.fraud} tone="rose" />
          <QueueRow label="Open risk alerts" value={metrics.totals.healthAlerts} tone="amber" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="hai-card p-5">
          <h2 className="text-sm font-bold text-[#111010] mb-3">Verified impact</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Waste" value={`${metrics.verified.wasteKg} kg`} />
            <Stat label="Sales" value={`$${metrics.verified.revenueUsd}`} />
            <Stat label="CO₂ avoided" value={`${metrics.verified.co2Kg} kg`} />
          </div>
        </div>

        <div className="hai-card p-5">
          <h2 className="text-sm font-bold text-[#111010] mb-3">Users by role</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.usersByRole).map(([role, count]) => (
              <span key={role} className="px-2.5 py-1 rounded-full bg-[#E6F1FA] text-[#005FA3] text-xs font-semibold">
                {role.replace(/_/g, ' ')} · {count}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function QueueRow({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'blue' | 'rose' }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    blue: 'bg-[#E6F1FA] text-[#005FA3] border-[#005FA3]/20',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
  };
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <span className="text-xs font-semibold">{label}</span>
      <span className="font-mono font-bold text-sm">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold text-[#111010]/55">{label}</div>
      <div className="text-sm font-bold font-mono text-[#111010] mt-0.5">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------- Users */

function UsersPanel({ onError }: { onError: (e: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [schools, setSchools] = useState<{ id: string; code: string; name: string }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'student', schoolId: '', password: '' });

  const load = useCallback(() => {
    api<{ users: AdminUser[]; roles: string[]; schools: any[] }>('/api/admin/users')
      .then((r) => {
        setUsers(r.users);
        setRoles(r.roles);
        setSchools(r.schools);
      })
      .catch((e) => onError(e.message));
  }, [onError]);

  useEffect(load, [load]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const r = await api<{ note: string }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setNotice(r.note);
      setForm({ fullName: '', email: '', role: 'student', schoolId: '', password: '' });
      load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (user: AdminUser) => {
    const newPassword = window.prompt(
      `Set a new password for ${user.email}.\n\nLeave blank to generate a recovery link instead.`
    );
    if (newPassword === null) return;

    setBusy(true);
    setNotice(null);
    try {
      const r = await api<{ message: string; link?: string | null }>(
        `/api/admin/users/${user.id}/reset-password`,
        { method: 'POST', body: JSON.stringify({ newPassword: newPassword || undefined }) }
      );
      setNotice(r.link ? `${r.message} ${r.link}` : r.message);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="hai-card p-5">
        <h2 className="text-sm font-bold text-[#111010] flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-[#005FA3]" /> Create a login
        </h2>
        <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <input
            required
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="hai-input px-3 py-2 text-sm lg:col-span-2"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="hai-input px-3 py-2 text-sm lg:col-span-2"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="hai-input px-3 py-2 text-sm"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={form.schoolId}
            onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
            className="hai-input px-3 py-2 text-sm"
          >
            <option value="">No school</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <input
            type="password"
            placeholder="Initial password (min 8)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="hai-input px-3 py-2 text-sm lg:col-span-2"
          />
          <button type="submit" disabled={busy} className="hai-btn-primary px-4 py-2 text-sm font-bold disabled:opacity-50">
            {busy ? 'Working…' : 'Create login'}
          </button>
        </form>

        {notice && (
          <div className="mt-3 rounded-lg bg-[#E6F1FA] border border-[#005FA3]/20 p-3 text-xs text-[#005FA3] break-all">
            {notice}
          </div>
        )}
      </div>

      <div className="hai-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#111010]/10 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#111010]">Accounts ({users.length})</h2>
          <button onClick={load} className="text-xs font-semibold text-[#005FA3] inline-flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F0F3F5] text-[#111010]/70 font-semibold">
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">School</th>
                <th className="py-2.5 px-4">Sign-in</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111010]/10">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#E6F1FA]/50">
                  <td className="py-2.5 px-4 font-semibold text-[#111010]">{u.full_name}</td>
                  <td className="py-2.5 px-4 text-[#111010]/70">{u.email}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-[#E6F1FA] text-[#005FA3] font-semibold">
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-[#111010]/70">{u.school_code || '—'}</td>
                  <td className="py-2.5 px-4">
                    {u.hasPassword ? (
                      <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> No password
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => resetPassword(u)}
                      disabled={busy}
                      className="text-[#005FA3] font-semibold hover:underline inline-flex items-center gap-1 disabled:opacity-40"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Features */

function FeaturesPanel({ onError }: { onError: (e: string) => void }) {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [labels, setLabels] = useState<Record<string, { label: string; description: string }>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api<{ features: any; labels: any }>('/api/admin/features')
      .then((r) => {
        setFeatures(r.features);
        setLabels(r.labels);
      })
      .catch((e) => onError(e.message));
  }, [onError]);

  const toggle = async (key: string) => {
    const next = !features[key];
    setFeatures({ ...features, [key]: next });
    try {
      await api('/api/admin/features', { method: 'PATCH', body: JSON.stringify({ [key]: next }) });
      setNotice('Saved.');
    } catch (e) {
      setFeatures({ ...features, [key]: !next });
      setNotice(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div className="hai-card p-5 space-y-1">
      <h2 className="text-sm font-bold text-[#111010] mb-3">Platform capabilities</h2>
      {Object.entries(labels).map(([key, meta]) => (
        <div key={key} className="flex items-start justify-between gap-4 py-3 border-b border-[#111010]/10 last:border-0">
          <div>
            <div className="text-sm font-semibold text-[#111010]">{meta.label}</div>
            <div className="text-xs text-[#111010]/65 mt-0.5">{meta.description}</div>
          </div>
          <button onClick={() => toggle(key)} className="shrink-0" aria-pressed={Boolean(features[key])}>
            {features[key] ? (
              <ToggleRight className="w-8 h-8 text-[#005FA3]" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-[#111010]/35" />
            )}
          </button>
        </div>
      ))}
      {notice && <div className="text-xs text-[#005FA3] pt-2">{notice}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ System */

function SystemPanel({ onError }: { onError: (e: string) => void }) {
  const [system, setSystem] = useState<any | null>(null);

  useEffect(() => {
    api<{ system: any }>('/api/admin/system')
      .then((r) => setSystem(r.system))
      .catch((e) => onError(e.message));
  }, [onError]);

  if (!system) return <Loading />;

  const Row = ({ label, value, ok }: { label: string; value: string; ok?: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b border-[#111010]/10 last:border-0">
      <span className="text-xs text-[#111010]/65">{label}</span>
      <span className={`text-xs font-mono font-semibold ${ok === false ? 'text-rose-700' : ok ? 'text-emerald-700' : 'text-[#111010]'}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="hai-card p-5">
        <h2 className="text-sm font-bold text-[#111010] mb-2">Application</h2>
        <Row label="URL" value={system.app.url} />
        <Row label="Environment" value={system.app.environment} />
        <Row label="Node" value={system.app.nodeVersion} />
      </div>

      <div className="hai-card p-5">
        <h2 className="text-sm font-bold text-[#111010] mb-2">Data &amp; storage</h2>
        <Row label="Supabase URL" value={system.data.supabaseUrl} />
        <Row label="Storage bucket" value={system.data.storageBucket} />
        <Row label="Service role key" value={system.data.serviceRoleConfigured ? 'configured' : 'missing'} ok={system.data.serviceRoleConfigured} />
        <Row label="Database" value={system.data.database.detail} ok={system.data.database.reachable} />
      </div>

      <div className="hai-card p-5 lg:col-span-2">
        <h2 className="text-sm font-bold text-[#111010] mb-2">WhatsApp channel</h2>
        <Row label="Webhook path" value={system.whatsapp.webhookPath} />
        <Row label="Verify token" value={system.whatsapp.verifyTokenConfigured ? 'configured' : 'missing'} ok={system.whatsapp.verifyTokenConfigured} />
        <Row label="Access token" value={system.whatsapp.accessTokenConfigured ? 'configured' : 'missing'} ok={system.whatsapp.accessTokenConfigured} />
        <Row label="App secret" value={system.whatsapp.appSecretConfigured ? 'configured' : 'missing'} ok={system.whatsapp.appSecretConfigured} />
        <Row label="Phone number ID" value={system.whatsapp.phoneNumberId} />
        <p className="text-[10px] text-[#111010]/45 mt-3">Checked {new Date(system.checkedAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="hai-card p-10 flex items-center justify-center gap-2 text-[#005FA3] text-sm font-semibold">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
    </div>
  );
}
