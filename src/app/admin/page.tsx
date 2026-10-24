'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Clubs } from './ClubsPanel';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';

type Tab = 'overview' | 'clubs' | 'people' | 'features' | 'system';

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
  school_id?: string | null;
  school_code?: string;
  hasPassword: boolean;
}

interface SchoolOption {
  id: string;
  code: string;
  name: string;
}

type Editor = { id: string; mode: 'password' | 'edit' } | null;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json as T;
}

const roleLabel = (r: string) => r.replace(/_/g, ' ');
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const SECTIONS: { id: Tab; label: string; blurb: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'Overview', blurb: 'What needs a decision today, and how the pilot is trending.', icon: ShieldCheck },
  { id: 'clubs', label: 'Clubs', blurb: 'Create school clubs, rename them, and move people in and out.', icon: Building2 },
  { id: 'people', label: 'People', blurb: 'Accounts, roles and access across every school.', icon: Users },
  { id: 'features', label: 'Capabilities', blurb: 'Switch platform functions on or off for everyone.', icon: Settings2 },
  { id: 'system', label: 'System', blurb: 'Hosting, storage and messaging service status.', icon: Server },
];

export default function SuperAdminConsole() {
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const section = SECTIONS.find((s) => s.id === tab)!;

  if (error) {
    return (
      <div className="min-h-screen bg-[#E6F1FA] flex items-center justify-center p-6">
        <div className="hai-card p-8 max-w-md text-center space-y-4">
          <Lock className="w-7 h-7 text-[#005FA3] mx-auto" />
          <div>
            <h1 className="text-lg font-bold text-[#0B2C4D] font-[var(--font-jakarta)]">Administrator sign-in required</h1>
            <p className="text-sm text-[#111010]/70 mt-1.5">{error}</p>
          </div>
          <Link href="/login?returnUrl=/admin" className="hai-btn-primary inline-block px-5 py-2.5 text-sm">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E6F1FA] lg:flex">
      <aside className="bg-white border-b lg:border-b-0 lg:border-r border-[#0B2C4D]/10 lg:w-60 lg:shrink-0 lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="px-5 py-5 border-b border-[#0B2C4D]/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[9px_9px_9px_2px] bg-[#0B2C4D] text-[#9CF2F2] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[#0B2C4D] leading-tight">Platform Management</div>
              <div className="text-[11px] text-[#111010]/55">I2I Clubs</div>
            </div>
          </div>
        </div>

        <nav className="p-2.5 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 lg:w-full px-3 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2.5 transition text-left ${
                  active ? 'bg-[#0B2C4D] text-white' : 'text-[#111010]/70 hover:bg-[#F0F3F5]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#9CF2F2]' : 'text-[#111010]/40'}`} />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block mt-auto p-4 border-t border-[#0B2C4D]/10">
          <Link href="/" className="text-xs font-semibold text-[#005FA3] hover:underline">
            Back to platform
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="w-full max-w-[1680px] px-5 sm:px-8 py-7">
          <div className="mb-6">
            <h1 className="text-[26px] leading-tight font-bold tracking-tight text-[#0B2C4D] font-[var(--font-jakarta)]">
              {section.label}
            </h1>
            <p className="text-sm text-[#111010]/65 mt-1 max-w-2xl">{section.blurb}</p>
          </div>

          {tab === 'overview' && <Overview onError={setError} onOpenPeople={() => setTab('people')} />}
          {tab === 'clubs' && <Clubs onError={setError} />}
          {tab === 'people' && <People onError={setError} />}
          {tab === 'features' && <Features onError={setError} />}
          {tab === 'system' && <SystemPanel onError={setError} />}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ common */

function Panel({
  title,
  meta,
  children,
  className = '',
  pad = true,
}: {
  title?: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`bg-white border border-[#0B2C4D]/10 rounded-[18px_18px_18px_5px] ${className}`}>
      {title && (
        <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-[13px] font-bold text-[#0B2C4D]">{title}</h2>
          {meta && <span className="text-[11px] text-[#111010]/50">{meta}</span>}
        </header>
      )}
      <div className={pad ? 'px-5 pb-5' : ''}>{children}</div>
    </section>
  );
}

function Figure({ value, label, unit, tone }: { value: string; label: string; unit?: string; tone?: 'teal' | 'alert' }) {
  return (
    <div>
      <div
        className={`text-[30px] leading-none font-bold tracking-tight [font-variant-numeric:tabular-nums] ${
          tone === 'teal' ? 'text-[#0F7B6C]' : tone === 'alert' ? 'text-[#9B1C31]' : 'text-[#0B2C4D]'
        }`}
      >
        {value}
        {unit && <span className="text-[13px] font-semibold text-[#111010]/45 ml-1">{unit}</span>}
      </div>
      <div className="text-[12px] text-[#111010]/60 mt-1.5">{label}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Overview */

function Overview({ onError, onOpenPeople }: { onError: (e: string) => void; onOpenPeople: () => void }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [people, setPeople] = useState<AdminUser[]>([]);

  const load = useCallback(() => {
    api<{ metrics: Metrics }>('/api/admin/metrics')
      .then((r) => setMetrics(r.metrics))
      .catch((e) => onError(e.message));
    api<{ users: AdminUser[] }>('/api/admin/users')
      .then((r) => setPeople(r.users))
      .catch(() => {});
  }, [onError]);

  useEffect(load, [load]);

  if (!metrics) return <Loading />;

  const maxActivity = Math.max(1, ...metrics.activity.map((d) => d.count));
  const totalQueue = metrics.queues.pendingTeacher + metrics.queues.pendingExpert;
  const roleTotal = Math.max(1, ...Object.values(metrics.usersByRole));
  const withoutPassword = people.filter((p) => !p.hasPassword);

  const queues = [
    { label: 'Waiting on a teacher', value: metrics.queues.pendingTeacher, tone: 'attention' as const },
    { label: 'Waiting on the expert panel', value: metrics.queues.pendingExpert, tone: 'attention' as const },
    { label: 'Flagged as fraud', value: metrics.queues.fraud, tone: 'alert' as const },
    { label: 'Open risk alerts', value: metrics.totals.healthAlerts, tone: 'attention' as const },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          title="Needs a decision"
          meta={totalQueue > 0 ? `${totalQueue} in a review queue` : 'Queues clear'}
          className="xl:col-span-7"
        >
          <ul className="divide-y divide-[#0B2C4D]/8 -mx-5">
            {queues.map((q) => (
              <li key={q.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <span className="flex items-center gap-2.5 text-[13px] text-[#111010]/80">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 ${q.value === 0 ? 'text-[#111010]/20' : q.tone === 'alert' ? 'text-[#9B1C31]' : 'text-[#8A5A00]'}`}
                  />
                  {q.label}
                </span>
                <span
                  className={`text-[19px] font-bold [font-variant-numeric:tabular-nums] ${
                    q.value === 0 ? 'text-[#111010]/25' : q.tone === 'alert' ? 'text-[#9B1C31]' : 'text-[#0B2C4D]'
                  }`}
                >
                  {q.value}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Verified impact" meta="Approved submissions only" className="xl:col-span-5">
          <div className="grid grid-cols-3 gap-4 pt-1">
            <Figure value={metrics.verified.wasteKg.toLocaleString()} unit="kg" label="Waste diverted" tone="teal" />
            <Figure value={`$${metrics.verified.revenueUsd.toLocaleString()}`} label="Student sales" />
            <Figure value={metrics.verified.co2Kg.toLocaleString()} unit="kg" label="CO₂ avoided" tone="teal" />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel title="Submissions" meta="Last 14 days" className="xl:col-span-7">
          <div className="flex items-end gap-1.5 h-44 mt-1">
            {metrics.activity.map((d) => (
              <div key={d.date} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5" title={`${d.date}: ${d.count}`}>
                <div
                  className="w-full rounded-t-[3px] bg-[#005FA3] min-h-[2px]"
                  style={{ height: `${Math.max(2, (d.count / maxActivity) * 100)}%` }}
                />
                <span className="text-[9px] text-[#111010]/40 [font-variant-numeric:tabular-nums]">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Who is on the platform" meta={`${metrics.totals.users} accounts`} className="xl:col-span-5">
          <ul className="space-y-2.5 mt-1">
            {Object.entries(metrics.usersByRole)
              .sort((a, b) => b[1] - a[1])
              .map(([role, count]) => (
                <li key={role} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[12px] text-[#111010]/70">{titleCase(roleLabel(role))}</span>
                  <span className="flex-1 h-2 rounded-full bg-[#E6F1FA] overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-[#005FA3]"
                      style={{ width: `${Math.max(3, (count / roleTotal) * 100)}%` }}
                    />
                  </span>
                  <span className="w-6 text-right text-[12px] font-semibold text-[#0B2C4D] [font-variant-numeric:tabular-nums]">
                    {count}
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          title="Accounts without a password"
          meta={withoutPassword.length === 0 ? 'All set' : `${withoutPassword.length} to issue`}
          className="xl:col-span-7"
        >
          {withoutPassword.length === 0 ? (
            <p className="text-[13px] text-[#111010]/55 py-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0F7B6C]" /> Every account can sign in.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-[#0B2C4D]/8 -mx-5">
                {withoutPassword.slice(0, 4).map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#111010] truncate">{u.full_name}</div>
                      <div className="text-[11px] text-[#111010]/55 truncate">{u.email}</div>
                    </div>
                    <span className="text-[11px] text-[#8A5A00] bg-[#FDF3DC] border border-[#8A5A00]/20 rounded-full px-2 py-0.5 shrink-0">
                      No password
                    </span>
                  </li>
                ))}
              </ul>
              <button onClick={onOpenPeople} className="mt-3 text-[12px] font-semibold text-[#005FA3] hover:underline">
                Issue passwords in People
              </button>
            </>
          )}
        </Panel>

        <Panel title="Registered" className="xl:col-span-5">
          <div className="grid grid-cols-2 gap-y-5 gap-x-4 pt-1">
            <Figure value={String(metrics.totals.schools)} label="Schools" />
            <Figure value={String(metrics.totals.clubs)} label="Clubs" />
            <Figure value={String(metrics.totals.users)} label="Accounts" />
            <Figure value={String(metrics.totals.submissions)} label="Submissions" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ People */

function People({ onError }: { onError: (e: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editor, setEditor] = useState<Editor>(null);
  const [password, setPassword] = useState('');
  const [editForm, setEditForm] = useState<{ role: string; schoolId: string }>({ role: 'student', schoolId: '' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'student', schoolId: '', password: '' });

  const load = useCallback(() => {
    api<{ users: AdminUser[]; roles: string[]; schools: SchoolOption[] }>('/api/admin/users')
      .then((r) => {
        setUsers(r.users);
        setRoles(r.roles);
        setSchools(r.schools);
      })
      .catch((e) => onError(e.message));
  }, [onError]);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQuery =
        !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.school_code ?? '').toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [users, query, roleFilter]);

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
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not create the account.' });
    } finally {
      setBusy(false);
    }
  };

  const runPassword = async (user: AdminUser, mode: 'set' | 'link') => {
    if (mode === 'set' && password.length < 8) {
      setNotice({ kind: 'err', text: 'A temporary password needs at least 8 characters.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const r = await api<{ message: string; link?: string | null }>(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: mode === 'set' ? password : undefined }),
      });
      setNotice({ kind: 'ok', text: r.link ? `${r.message} ${r.link}` : r.message });
      if (mode === 'set') {
        setEditor(null);
        setPassword('');
      }
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not update the password.' });
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (user: AdminUser) => {
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: editForm.role, schoolId: editForm.schoolId || null }),
      });
      setNotice({ kind: 'ok', text: `Updated ${user.full_name}.` });
      setEditor(null);
      load();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not save changes.' });
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (user: AdminUser) => {
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      setNotice({ kind: 'ok', text: `Deleted ${user.email}.` });
      setConfirmDelete(null);
      load();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not delete the account.' });
    } finally {
      setBusy(false);
    }
  };

  const openEditor = (user: AdminUser, mode: 'password' | 'edit') => {
    setEditor(editor?.id === user.id && editor.mode === mode ? null : { id: user.id, mode });
    setPassword('');
    setEditForm({ role: user.role, schoolId: user.school_id ?? '' });
    setConfirmDelete(null);
    setNotice(null);
  };

  const toggleDelete = (user: AdminUser) => {
    setConfirmDelete(confirmDelete === user.id ? null : user.id);
    setEditor(null);
    setNotice(null);
  };

  /* Shared pieces so the table and the small-screen cards behave identically. */

  const actionsFor = (u: AdminUser) => (
    <div className="flex items-center gap-1 justify-end shrink-0">
      <button
        onClick={() => openEditor(u, 'password')}
        title="Set a temporary password"
        aria-label={`Set password for ${u.full_name}`}
        className={`p-1.5 rounded-md hover:bg-[#E6F1FA] ${editor?.id === u.id && editor.mode === 'password' ? 'bg-[#E6F1FA] text-[#005FA3]' : 'text-[#111010]/50'}`}
      >
        <KeyRound className="w-4 h-4" />
      </button>
      <button
        onClick={() => openEditor(u, 'edit')}
        title="Change role or school"
        aria-label={`Edit ${u.full_name}`}
        className={`p-1.5 rounded-md hover:bg-[#E6F1FA] ${editor?.id === u.id && editor.mode === 'edit' ? 'bg-[#E6F1FA] text-[#005FA3]' : 'text-[#111010]/50'}`}
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        onClick={() => toggleDelete(u)}
        title="Delete this account"
        aria-label={`Delete ${u.full_name}`}
        className={`p-1.5 rounded-md hover:bg-[#FBE9EC] ${confirmDelete === u.id ? 'bg-[#FBE9EC] text-[#9B1C31]' : 'text-[#111010]/50'}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  const editorsFor = (u: AdminUser) => (
    <>
      {editor?.id === u.id && editor.mode === 'password' && (
        <div className="flex flex-wrap items-end gap-2 pt-3">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor={`pw-${u.id}`} className="block text-[11px] font-semibold text-[#111010]/60 mb-1">
              Temporary password for {u.email}
            </label>
            <input
              id={`pw-${u.id}`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters — share it with them directly"
              className="w-full hai-input px-3 py-2 text-[13px]"
            />
          </div>
          <button onClick={() => runPassword(u, 'set')} disabled={busy || !u.hasPassword} className="hai-btn-primary px-4 py-2 text-[12px] font-bold disabled:opacity-40">
            Set password
          </button>
          <button onClick={() => runPassword(u, 'link')} disabled={busy || !u.hasPassword} className="hai-btn-secondary px-4 py-2 text-[12px] font-bold disabled:opacity-40">
            Send reset link
          </button>
          {!u.hasPassword && (
            <span className="text-[11px] text-[#8A5A00] pb-2 w-full">No sign-in account yet — create one with a password first.</span>
          )}
        </div>
      )}

      {editor?.id === u.id && editor.mode === 'edit' && (
        <div className="flex flex-wrap items-end gap-2 pt-3">
          <div>
            <label htmlFor={`role-${u.id}`} className="block text-[11px] font-semibold text-[#111010]/60 mb-1">
              Role
            </label>
            <select
              id={`role-${u.id}`}
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              className="hai-input px-3 py-2 text-[13px]"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {titleCase(roleLabel(r))}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`school-${u.id}`} className="block text-[11px] font-semibold text-[#111010]/60 mb-1">
              School
            </label>
            <select
              id={`school-${u.id}`}
              value={editForm.schoolId}
              onChange={(e) => setEditForm({ ...editForm, schoolId: e.target.value })}
              className="hai-input px-3 py-2 text-[13px]"
            >
              <option value="">No school</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <button onClick={() => saveEdit(u)} disabled={busy} className="hai-btn-primary px-4 py-2 text-[12px] font-bold disabled:opacity-40">
            Save changes
          </button>
          <button onClick={() => setEditor(null)} className="px-3 py-2 text-[12px] font-semibold text-[#111010]/60 hover:underline">
            Cancel
          </button>
        </div>
      )}

      {confirmDelete === u.id && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
          <p className="text-[12px] text-[#9B1C31]">
            Delete <strong>{u.full_name}</strong> ({u.email})? This removes the sign-in account and cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 text-[12px] font-semibold text-[#111010]/60 hover:underline">
              Keep account
            </button>
            <button onClick={() => removeUser(u)} disabled={busy} className="px-4 py-2 rounded-full bg-[#9B1C31] text-white text-[12px] font-bold disabled:opacity-40">
              Delete permanently
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#111010]/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or school"
              className="hai-input pl-8 pr-3 py-2 text-[13px] w-56"
              aria-label="Search accounts"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="hai-input px-3 py-2 text-[13px]"
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {titleCase(roleLabel(r))}
              </option>
            ))}
          </select>
          <button onClick={load} className="text-[12px] font-semibold text-[#005FA3] hover:underline inline-flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="hai-btn-primary px-4 py-2 text-[13px] font-bold inline-flex items-center gap-1.5"
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : 'Create login'}
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-xl border p-3 text-[12px] break-all ${
            notice.kind === 'ok' ? 'bg-[#EDF7F4] border-[#0F7B6C]/30 text-[#0B5A4E]' : 'bg-[#FBE9EC] border-[#9B1C31]/25 text-[#9B1C31]'
          }`}
          role="status"
        >
          {notice.text}
        </div>
      )}

      {showCreate && (
        <form onSubmit={createUser} className="bg-white border border-[#0B2C4D]/10 rounded-[18px_18px_18px_5px] p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="hai-input px-3 py-2 text-[13px] lg:col-span-2" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="hai-input px-3 py-2 text-[13px] lg:col-span-2" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="hai-input px-3 py-2 text-[13px]">
            {roles.map((r) => (
              <option key={r} value={r}>
                {titleCase(roleLabel(r))}
              </option>
            ))}
          </select>
          <select value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })} className="hai-input px-3 py-2 text-[13px]">
            <option value="">No school</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <input type="password" placeholder="Temporary password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="hai-input px-3 py-2 text-[13px] lg:col-span-4" />
          <button type="submit" disabled={busy} className="hai-btn-primary px-4 py-2 text-[13px] font-bold disabled:opacity-50">
            {busy ? 'Creating…' : 'Create login'}
          </button>
        </form>
      )}

      <div className="bg-white border border-[#0B2C4D]/10 rounded-[18px_18px_18px_5px] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#0B2C4D]/10 flex items-baseline justify-between">
          <h2 className="text-[13px] font-bold text-[#0B2C4D]">
            {visible.length} of {users.length} accounts
          </h2>
          {roleFilter !== 'all' && (
            <button onClick={() => setRoleFilter('all')} className="text-[11px] text-[#005FA3] hover:underline">
              Clear filter
            </button>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="bg-[#F7FAFC] text-[11px] font-semibold text-[#111010]/55">
                <th className="py-2.5 px-5">Name</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">School</th>
                <th className="py-2.5 px-4">Sign-in</th>
                <th className="py-2.5 px-5 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0B2C4D]/8">
              {visible.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="hover:bg-[#F7FAFC] align-top">
                    <td className="py-2.5 px-5 text-[13px] font-semibold text-[#111010]">{u.full_name}</td>
                    <td className="py-2.5 px-4 text-[12px] text-[#111010]/65">{u.email}</td>
                    <td className="py-2.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-[#E6F1FA] text-[#005FA3] text-[11px] font-semibold whitespace-nowrap">
                        {titleCase(roleLabel(u.role))}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[12px] text-[#111010]/65">{u.school_code ?? '—'}</td>
                    <td className="py-2.5 px-4">{signInBadge(u)}</td>
                    <td className="py-2.5 px-5">{actionsFor(u)}</td>
                  </tr>
                  {(editor?.id === u.id || confirmDelete === u.id) && (
                    <tr className={confirmDelete === u.id ? 'bg-[#FBE9EC]' : 'bg-[#F7FAFC]'}>
                      <td colSpan={6} className="px-5 pb-4">
                        {editorsFor(u)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[13px] text-[#111010]/55">
                    No accounts match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <ul className="md:hidden divide-y divide-[#0B2C4D]/8">
          {visible.map((u) => (
            <li key={u.id} className={`p-4 ${confirmDelete === u.id ? 'bg-[#FBE9EC]' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#111010] truncate">{u.full_name}</div>
                  <div className="text-[11px] text-[#111010]/55 truncate">{u.email}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-[#E6F1FA] text-[#005FA3] text-[10px] font-semibold">
                      {titleCase(roleLabel(u.role))}
                    </span>
                    {u.school_code && <span className="text-[10px] text-[#111010]/50">{u.school_code}</span>}
                    {signInBadge(u)}
                  </div>
                </div>
                {actionsFor(u)}
              </div>
              {editorsFor(u)}
            </li>
          ))}
          {visible.length === 0 && <li className="px-5 py-10 text-center text-[13px] text-[#111010]/55">No accounts match that search.</li>}
        </ul>
      </div>
    </div>
  );
}

function signInBadge(u: AdminUser) {
  return u.hasPassword ? (
    <span className="text-[#0F7B6C] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5" /> Active
    </span>
  ) : (
    <span className="text-[#8A5A00] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
      <AlertTriangle className="w-3.5 h-3.5" /> No password
    </span>
  );
}

/* --------------------------------------------------------------- Features */

function Features({ onError }: { onError: (e: string) => void }) {
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
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Could not save that change.' });
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      {notice && (
        <div
          className={`rounded-xl border p-3 text-[12px] ${
            notice.kind === 'ok' ? 'bg-[#EDF7F4] border-[#0F7B6C]/30 text-[#0B5A4E]' : 'bg-[#FBE9EC] border-[#9B1C31]/25 text-[#9B1C31]'
          }`}
          role="status"
        >
          {notice.text}
        </div>
      )}
      <div className="bg-white border border-[#0B2C4D]/10 rounded-[18px_18px_18px_5px] divide-y divide-[#0B2C4D]/8">
        {Object.entries(labels).map(([key, meta]) => {
          const on = Boolean(features[key]);
          return (
            <div key={key} className="flex items-start justify-between gap-6 px-5 py-4">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[#111010]">{meta.label}</div>
                <div className="text-[12px] text-[#111010]/60 mt-0.5">{meta.description}</div>
              </div>
              <button
                onClick={() => toggle(key)}
                role="switch"
                aria-checked={on}
                aria-label={meta.label}
                className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${on ? 'bg-[#0F7B6C]' : 'bg-[#111010]/20'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}>
                  {on && <Check className="w-3 h-3 text-[#0F7B6C] mx-auto mt-1" />}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- System */

function SystemPanel({ onError }: { onError: (e: string) => void }) {
  const [system, setSystem] = useState<any | null>(null);

  useEffect(() => {
    api<{ system: any }>('/api/admin/system')
      .then((r) => setSystem(r.system))
      .catch((e) => onError(e.message));
  }, [onError]);

  if (!system) return <Loading />;

  const Row = ({ label, value, ok }: { label: string; value: string; ok?: boolean }) => (
    <div className="flex items-baseline justify-between gap-6 py-2.5 border-b border-[#0B2C4D]/8 last:border-0">
      <span className="text-[12px] text-[#111010]/60">{label}</span>
      <span className={`text-[12px] font-semibold text-right break-all ${ok === false ? 'text-[#9B1C31]' : ok ? 'text-[#0F7B6C]' : 'text-[#111010]'}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-5xl">
      <Panel title="Application">
        <Row label="URL" value={system.app.url} />
        <Row label="Environment" value={system.app.environment} />
        <Row label="Node" value={system.app.nodeVersion} />
      </Panel>

      <Panel title="Data and storage">
        <Row label="Supabase URL" value={system.data.supabaseUrl} />
        <Row label="Storage bucket" value={system.data.storageBucket} />
        <Row label="Service role key" value={system.data.serviceRoleConfigured ? 'Configured' : 'Missing'} ok={system.data.serviceRoleConfigured} />
        <Row label="Database" value={system.data.database.detail} ok={system.data.database.reachable} />
      </Panel>

      <Panel title="WhatsApp channel" className="xl:col-span-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
          <div>
            <Row label="Webhook path" value={system.whatsapp.webhookPath} />
            <Row label="Verify token" value={system.whatsapp.verifyTokenConfigured ? 'Configured' : 'Missing'} ok={system.whatsapp.verifyTokenConfigured} />
            <Row label="Access token" value={system.whatsapp.accessTokenConfigured ? 'Configured' : 'Missing'} ok={system.whatsapp.accessTokenConfigured} />
          </div>
          <div>
            <Row label="App secret" value={system.whatsapp.appSecretConfigured ? 'Configured' : 'Missing'} ok={system.whatsapp.appSecretConfigured} />
            <Row label="Phone number ID" value={system.whatsapp.phoneNumberId} />
            <Row label="Checked" value={new Date(system.checkedAt).toLocaleString()} />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Loading() {
  return (
    <div className="bg-white border border-[#0B2C4D]/10 rounded-[18px_18px_18px_5px] p-12 flex items-center justify-center gap-2 text-[#005FA3] text-[13px] font-semibold">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
    </div>
  );
}
