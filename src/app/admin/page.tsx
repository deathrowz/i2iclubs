'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
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
  X,
} from 'lucide-react';

type Tab = 'overview' | 'users' | 'features' | 'system';

interface Metrics {
  totals: { schools: number; clubs: number; users: number; submissions: number; auditEntries: number; healthAlerts: number };
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

const SECTIONS: { id: Tab; label: string; blurb: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', blurb: 'What needs attention across the pilot, and how it is trending.', icon: BarChart3 },
  { id: 'users', label: 'Users & access', blurb: 'Issue logins, assign schools and roles, and reset passwords.', icon: Users },
  { id: 'features', label: 'Features', blurb: 'Switch platform capabilities on or off for everyone.', icon: Settings2 },
  { id: 'system', label: 'System', blurb: 'Hosting, storage and messaging service status.', icon: Server },
];

export default function SuperAdminConsole() {
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const section = SECTIONS.find((s) => s.id === tab)!;

  if (error) {
    return (
      <div className="min-h-screen bg-[#E6F1FA] flex items-center justify-center p-6">
        <div className="hai-card p-8 max-w-md text-center space-y-3">
          <Lock className="w-8 h-8 text-[#005FA3] mx-auto" />
          <h1 className="text-lg font-bold text-[#111010] font-[var(--font-jakarta)]">Administrator sign-in required</h1>
          <p className="text-sm text-[#111010]/70">{error}</p>
          <Link href="/login?returnUrl=/admin" className="hai-btn-primary inline-block px-5 py-2.5 text-sm">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E6F1FA] lg:flex">
      {/* Console rail — persistent orientation across sections */}
      <aside className="bg-white border-b lg:border-b-0 lg:border-r border-[#111010]/10 lg:w-64 lg:shrink-0 lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-[#111010]/10">
          <div className="w-9 h-9 rounded-[10px_10px_10px_2px] bg-[#005FA3] text-[#9CF2F2] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#111010] leading-tight">Platform Management</div>
            <div className="text-[11px] text-[#111010]/60">Super administrator</div>
          </div>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 lg:w-full px-3.5 py-2.5 rounded-lg text-[13px] font-semibold flex items-center gap-2.5 transition text-left ${
                  active
                    ? 'bg-[#E6F1FA] text-[#005FA3]'
                    : 'text-[#111010]/70 hover:bg-[#F0F3F5] hover:text-[#111010]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#005FA3]' : 'text-[#111010]/45'}`} />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block mt-auto p-4 border-t border-[#111010]/10">
          <Link href="/" className="text-xs font-semibold text-[#005FA3] hover:underline">
            ← Back to platform
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-[1080px] px-6 py-8 lg:px-10">
          <header className="mb-7">
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#111010] font-[var(--font-jakarta)]">
              {section.label}
            </h1>
            <p className="text-sm text-[#111010]/65 mt-1.5 max-w-2xl">{section.blurb}</p>
          </header>

          {tab === 'overview' && <Overview onError={setError} />}
          {tab === 'users' && <UsersPanel onError={setError} />}
          {tab === 'features' && <FeaturesPanel onError={setError} />}
          {tab === 'system' && <SystemPanel onError={setError} />}
        </div>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- Overview */

function Overview({ onError }: { onError: (e: string) => void }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    api<{ metrics: Metrics }>('/api/admin/metrics')
      .then((r) => setMetrics(r.metrics))
      .catch((e) => onError(e.message));
  }, [onError]);

  if (!metrics) return <Loading />;

  const maxActivity = Math.max(1, ...metrics.activity.map((d) => d.count));
  const totalQueue = metrics.queues.pendingTeacher + metrics.queues.pendingExpert;

  // Work needing a decision comes first; inventory counts are context, not tasks.
  const attention = [
    { label: 'Awaiting teacher review', value: metrics.queues.pendingTeacher, tone: 'amber' as const },
    { label: 'Awaiting expert panel', value: metrics.queues.pendingExpert, tone: 'blue' as const },
    { label: 'Flagged for fraud', value: metrics.queues.fraud, tone: 'rose' as const },
    { label: 'Open risk alerts', value: metrics.totals.healthAlerts, tone: 'amber' as const },
  ];

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#111010]">Needs attention</h2>
          <span className="text-xs text-[#111010]/55">
            {totalQueue > 0 ? `${totalQueue} submission${totalQueue === 1 ? '' : 's'} in a review queue` : 'All review queues clear'}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {attention.map((a) => (
            <div
              key={a.label}
              className={`rounded-[16px_16px_16px_4px] border p-4 ${
                a.value > 0
                  ? a.tone === 'rose'
                    ? 'bg-rose-50 border-rose-200'
                    : a.tone === 'amber'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-white border-[#005FA3]/25'
                  : 'bg-white border-[#111010]/12'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`text-xs font-semibold leading-snug ${a.value > 0 ? 'text-[#111010]' : 'text-[#111010]/55'}`}>
                  {a.label}
                </span>
                {a.value > 0 && <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${a.tone === 'rose' ? 'text-rose-600' : 'text-amber-600'}`} />}
              </div>
              <div className={`text-3xl font-extrabold font-mono mt-2 ${a.value > 0 ? 'text-[#111010]' : 'text-[#111010]/30'}`}>
                {a.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="hai-card p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-bold text-[#111010]">Submissions</h2>
            <span className="text-[11px] text-[#111010]/55">Last 14 days</span>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {metrics.activity.map((d) => (
              <div
                key={d.date}
                className="flex-1 h-full flex flex-col items-center justify-end gap-1"
                title={`${d.date}: ${d.count}`}
              >
                <div
                  className="w-full rounded-t bg-[#005FA3] min-h-[2px]"
                  style={{ height: `${Math.max(2, (d.count / maxActivity) * 100)}%` }}
                />
                <span className="text-[9px] text-[#111010]/45 font-mono">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hai-card p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-bold text-[#111010]">Verified impact</h2>
            <span className="text-[11px] text-[#111010]/55">Approved only</span>
          </div>
          <dl className="space-y-3">
            {[
              { k: 'Waste diverted', v: `${metrics.verified.wasteKg} kg` },
              { k: 'Student sales', v: `$${metrics.verified.revenueUsd.toLocaleString()}` },
              { k: 'CO₂ avoided', v: `${metrics.verified.co2Kg} kg` },
            ].map((row) => (
              <div key={row.k} className="flex items-baseline justify-between gap-3 border-b border-[#111010]/8 pb-2 last:border-0 last:pb-0">
                <dt className="text-xs text-[#111010]/65">{row.k}</dt>
                <dd className="font-mono font-bold text-sm text-[#111010]">{row.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <section className="hai-card p-5">
        <h2 className="text-sm font-bold text-[#111010] mb-4">Registered on the platform</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Schools', value: metrics.totals.schools },
            { label: 'Clubs', value: metrics.totals.clubs },
            { label: 'Users', value: metrics.totals.users },
            { label: 'Submissions', value: metrics.totals.submissions },
          ].map((c) => (
            <div key={c.label}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#111010]/50">{c.label}</div>
              <div className="text-2xl font-extrabold font-mono text-[#111010] mt-0.5">{c.value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-[#111010]/10">
          {Object.entries(metrics.usersByRole).map(([role, count]) => (
            <span key={role} className="px-2.5 py-1 rounded-full bg-[#E6F1FA] text-[#005FA3] text-[11px] font-semibold">
              {role.replace(/_/g, ' ')} · {count}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- Users */

function UsersPanel({ onError }: { onError: (e: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [schools, setSchools] = useState<{ id: string; code: string; name: string }[]>([]);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');
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
      const r = await api<{ note: string }>('/api/admin/users', { method: 'POST', body: JSON.stringify(form) });
      setNotice({ kind: 'ok', text: r.note });
      setForm({ fullName: '', email: '', role: 'student', schoolId: '', password: '' });
      setShowCreate(false);
      load();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(false);
    }
  };

  const doReset = async (user: AdminUser, mode: 'set' | 'link') => {
    if (mode === 'set' && resetPw.length < 8) {
      setNotice({ kind: 'err', text: 'Password must be at least 8 characters.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const r = await api<{ message: string; link?: string | null }>(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: mode === 'set' ? resetPw : undefined }),
      });
      setNotice({ kind: 'ok', text: r.link ? `${r.message} ${r.link}` : r.message });
      setResetFor(null);
      setResetPw('');
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#111010]">{users.length} accounts</span>
          <button onClick={load} className="text-xs font-semibold text-[#005FA3] inline-flex items-center gap-1 hover:underline">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="hai-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5"
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : 'Create login'}
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-xl border p-3 text-xs break-all ${
            notice.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notice.text}
        </div>
      )}

      {showCreate && (
        <form onSubmit={createUser} className="hai-card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            required
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="hai-input px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="hai-input px-3 py-2 text-sm"
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="hai-input px-3 py-2 text-sm">
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })} className="hai-input px-3 py-2 text-sm">
            <option value="">No school</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <input
            type="password"
            placeholder="Initial password (min 8)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="hai-input px-3 py-2 text-sm"
          />
          <button type="submit" disabled={busy} className="hai-btn-primary px-4 py-2 text-sm font-bold disabled:opacity-50">
            {busy ? 'Creating…' : 'Create login'}
          </button>
        </form>
      )}

      <div className="hai-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="bg-[#F0F3F5] text-[#111010]/70 font-semibold">
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">School</th>
                <th className="py-2.5 px-4">Sign-in</th>
                <th className="py-2.5 px-4 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111010]/10">
              {users.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="hover:bg-[#E6F1FA]/50 align-top">
                    <td className="py-2.5 px-4 font-semibold text-[#111010]">{u.full_name}</td>
                    <td className="py-2.5 px-4 text-[#111010]/70">{u.email}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-[#E6F1FA] text-[#005FA3] font-semibold whitespace-nowrap">
                        {u.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#111010]/70">{u.school_code || '—'}</td>
                    <td className="py-2.5 px-4">
                      {u.hasPassword ? (
                        <span className="text-emerald-700 font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                          <AlertTriangle className="w-3.5 h-3.5" /> No password
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setResetFor(resetFor === u.id ? null : u.id);
                          setResetPw('');
                          setNotice(null);
                        }}
                        className="text-[#005FA3] font-semibold hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> {resetFor === u.id ? 'Close' : 'Reset'}
                      </button>
                    </td>
                  </tr>

                  {resetFor === u.id && (
                    <tr className="bg-[#F8FAFC]">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="flex-1 min-w-[200px]">
                            <label htmlFor={`pw-${u.id}`} className="block text-[10px] font-bold uppercase tracking-wider text-[#111010]/60 mb-1">
                              New password for {u.email}
                            </label>
                            <input
                              id={`pw-${u.id}`}
                              type="password"
                              value={resetPw}
                              onChange={(e) => setResetPw(e.target.value)}
                              placeholder="At least 8 characters"
                              className="w-full hai-input px-3 py-2 text-sm"
                            />
                          </div>
                          <button
                            onClick={() => doReset(u, 'set')}
                            disabled={busy || !u.hasPassword}
                            className="hai-btn-primary px-4 py-2 text-xs font-bold disabled:opacity-40"
                          >
                            Set password
                          </button>
                          <button
                            onClick={() => doReset(u, 'link')}
                            disabled={busy || !u.hasPassword}
                            className="hai-btn-secondary px-4 py-2 text-xs font-bold disabled:opacity-40"
                          >
                            Email reset link
                          </button>
                          {!u.hasPassword && (
                            <span className="text-[11px] text-amber-700 pb-2">
                              This profile has no sign-in account yet — create one with a password first.
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Features */

function FeaturesPanel({ onError }: { onError: (e: string) => void }) {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [labels, setLabels] = useState<Record<string, { label: string; description: string }>>({});
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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
      setNotice({ kind: 'ok', text: 'Saved.' });
    } catch (e) {
      setFeatures({ ...features, [key]: !next });
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Failed' });
    }
  };

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={`rounded-xl border p-3 text-xs ${
            notice.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notice.text}
        </div>
      )}
      <div className="hai-card divide-y divide-[#111010]/10">
        {Object.entries(labels).map(([key, meta]) => (
          <div key={key} className="flex items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#111010]">{meta.label}</div>
              <div className="text-xs text-[#111010]/65 mt-0.5">{meta.description}</div>
            </div>
            <button
              onClick={() => toggle(key)}
              aria-pressed={Boolean(features[key])}
              aria-label={`${features[key] ? 'Disable' : 'Enable'} ${meta.label}`}
              className="shrink-0"
            >
              {features[key] ? (
                <ToggleRight className="w-9 h-9 text-[#005FA3]" />
              ) : (
                <ToggleLeft className="w-9 h-9 text-[#111010]/30" />
              )}
            </button>
          </div>
        ))}
      </div>
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
    <div className="flex items-center justify-between gap-4 py-2 border-b border-[#111010]/8 last:border-0">
      <span className="text-xs text-[#111010]/60">{label}</span>
      <span
        className={`text-xs font-mono font-semibold text-right break-all ${
          ok === false ? 'text-rose-700' : ok ? 'text-emerald-700' : 'text-[#111010]'
        }`}
      >
        {value}
      </span>
    </div>
  );

  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="hai-card p-5">
      <h2 className="text-sm font-bold text-[#111010] mb-2">{title}</h2>
      {children}
    </section>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Group title="Application">
          <Row label="URL" value={system.app.url} />
          <Row label="Environment" value={system.app.environment} />
          <Row label="Node" value={system.app.nodeVersion} />
        </Group>

        <Group title="Data & storage">
          <Row label="Supabase URL" value={system.data.supabaseUrl} />
          <Row label="Storage bucket" value={system.data.storageBucket} />
          <Row label="Service role key" value={system.data.serviceRoleConfigured ? 'configured' : 'missing'} ok={system.data.serviceRoleConfigured} />
          <Row label="Database" value={system.data.database.detail} ok={system.data.database.reachable} />
        </Group>
      </div>

      <Group title="WhatsApp channel">
        <Row label="Webhook path" value={system.whatsapp.webhookPath} />
        <Row label="Verify token" value={system.whatsapp.verifyTokenConfigured ? 'configured' : 'missing'} ok={system.whatsapp.verifyTokenConfigured} />
        <Row label="Access token" value={system.whatsapp.accessTokenConfigured ? 'configured' : 'missing'} ok={system.whatsapp.accessTokenConfigured} />
        <Row label="App secret" value={system.whatsapp.appSecretConfigured ? 'configured' : 'missing'} ok={system.whatsapp.appSecretConfigured} />
        <Row label="Phone number ID" value={system.whatsapp.phoneNumberId} />
        <p className="text-[10px] text-[#111010]/45 mt-3">Checked {new Date(system.checkedAt).toLocaleString()}</p>
      </Group>
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
