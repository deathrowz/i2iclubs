'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  hasPassword: boolean;
  lastSeenAt: string | null;
  hoursLast7Days: number;
}

interface ClubRow {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  circular_sector: string;
  school_id: string;
  school_name: string;
  school_code: string;
  last_submission_at: string;
  memberCount: number;
  members: ClubMember[];
  lastSeenAt: string | null;
}

interface SchoolOption {
  id: string;
  code: string;
  name: string;
}

interface PersonOption {
  id: string;
  full_name: string;
  email: string;
  club_id?: string | null;
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

function relativeSeen(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function Panel({ title, meta, children }: { title?: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[#0B2C4D]/10 rounded-[18px_18px_18px_5px]">
      {title && (
        <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-[13px] font-bold text-[#0B2C4D]">{title}</h2>
          {meta && <span className="text-[11px] text-[#111010]/50">{meta}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Clubs({ onError }: { onError: (e: string) => void }) {
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({ schoolId: '', name: '', tagline: '', circularSector: '' });
  const [editForm, setEditForm] = useState({ name: '', tagline: '', circularSector: '', schoolId: '' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<{ clubs: ClubRow[]; schools: SchoolOption[] }>('/api/admin/clubs'),
      api<{ users: PersonOption[] }>('/api/admin/users'),
    ])
      .then(([c, u]) => {
        setClubs(c.clubs);
        setSchools(c.schools);
        setPeople(u.users);
      })
      .catch((e) => onError(e.message))
      .finally(() => setLoading(false));
  }, [onError]);

  useEffect(load, [load]);

  const unassigned = useMemo(() => people.filter((p) => !p.club_id), [people]);

  const createClub = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await api('/api/admin/clubs', { method: 'POST', body: JSON.stringify(createForm) });
      setNotice({ kind: 'ok', text: `Created ${createForm.name}.` });
      setCreateForm({ schoolId: '', name: '', tagline: '', circularSector: '' });
      setShowCreate(false);
      load();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not create the club.' });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (club: ClubRow) => {
    setEditing(club.id);
    setEditForm({
      name: club.name,
      tagline: club.tagline,
      circularSector: club.circular_sector,
      schoolId: club.school_id,
    });
    setConfirmDelete(null);
    setNotice(null);
  };

  const saveEdit = async (club: ClubRow) => {
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/admin/clubs/${club.id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setNotice({ kind: 'ok', text: `Updated ${editForm.name}.` });
      setEditing(null);
      load();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not save the club.' });
    } finally {
      setBusy(false);
    }
  };

  const removeClub = async (club: ClubRow) => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await api<{ unassignedUsers: number }>(`/api/admin/clubs/${club.id}`, { method: 'DELETE' });
      setNotice({
        kind: 'ok',
        text: r.unassignedUsers
          ? `Deleted ${club.name}. ${r.unassignedUsers} ${r.unassignedUsers === 1 ? 'person is' : 'people are'} now unassigned.`
          : `Deleted ${club.name}.`,
      });
      setConfirmDelete(null);
      load();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not delete the club.' });
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (club: ClubRow, userId: string) => {
    if (!userId) return;
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ clubId: club.id }) });
      setNotice({ kind: 'ok', text: 'Added to the club.' });
      load();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not add that person.' });
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (member: ClubMember) => {
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/admin/users/${member.id}`, { method: 'PATCH', body: JSON.stringify({ clubId: null }) });
      setNotice({ kind: 'ok', text: `${member.full_name} removed from the club.` });
      load();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not remove them.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-[#0B2C4D]">{clubs.length} clubs</span>
          <button onClick={load} className="text-[12px] font-semibold text-[#005FA3] hover:underline inline-flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {unassigned.length > 0 && (
            <span className="text-[11px] text-[#8A5A00] bg-[#FDF3DC] border border-[#8A5A00]/20 rounded-full px-2 py-0.5">
              {unassigned.length} not in a club
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="hai-btn-primary px-4 py-2 text-[13px] font-bold inline-flex items-center gap-1.5"
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : 'Create club'}
        </button>
      </div>

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

      {showCreate && (
        <form onSubmit={createClub} className="bg-white border border-[#0B2C4D]/10 rounded-[18px_18px_18px_5px] p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold text-[#111010]/60 mb-1">School</span>
            <select
              required
              value={createForm.schoolId}
              onChange={(e) => setCreateForm({ ...createForm, schoolId: e.target.value })}
              className="w-full hai-input px-3 py-2 text-[13px]"
            >
              <option value="">Choose a school</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-[#111010]/60 mb-1">Club name</span>
            <input
              required
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="e.g. Royal Eco-Plast Upcyclers"
              className="w-full hai-input px-3 py-2 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-[#111010]/60 mb-1">One-line description</span>
            <input
              value={createForm.tagline}
              onChange={(e) => setCreateForm({ ...createForm, tagline: e.target.value })}
              placeholder="What the club does"
              className="w-full hai-input px-3 py-2 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-[#111010]/60 mb-1">Circular sector</span>
            <input
              value={createForm.circularSector}
              onChange={(e) => setCreateForm({ ...createForm, circularSector: e.target.value })}
              placeholder="e.g. Plastic upcycling"
              className="w-full hai-input px-3 py-2 text-[13px]"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="hai-btn-primary px-4 py-2 text-[13px] font-bold disabled:opacity-50">
              {busy ? 'Creating…' : 'Create club'}
            </button>
          </div>
        </form>
      )}

      <Panel>
        {loading && clubs.length === 0 ? (
          <div className="p-10 flex items-center justify-center gap-2 text-[#005FA3] text-[13px] font-semibold">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading clubs…
          </div>
        ) : clubs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[13px] text-[#111010]/60">No clubs yet. Create the first one to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#0B2C4D]/8">
            {clubs.map((club) => {
              const open = expanded === club.id;
              return (
                <li key={club.id}>
                  <div className="flex items-start gap-3 px-5 py-3.5">
                    <button
                      onClick={() => setExpanded(open ? null : club.id)}
                      className="mt-0.5 p-1 rounded-md hover:bg-[#E6F1FA] text-[#111010]/45"
                      aria-label={open ? `Collapse ${club.name}` : `Expand ${club.name}`}
                      aria-expanded={open}
                    >
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-[#111010]">{club.name}</div>
                      <div className="text-[11px] text-[#111010]/55 truncate">{club.tagline}</div>
                    </div>

                    <div className="hidden sm:block w-20 shrink-0">
                      <div className="text-[11px] text-[#111010]/45">School</div>
                      <div className="text-[12px] text-[#111010]/75">{club.school_code}</div>
                    </div>
                    <div className="hidden lg:block w-40 shrink-0">
                      <div className="text-[11px] text-[#111010]/45">Sector</div>
                      <div className="text-[12px] text-[#111010]/75 truncate">{club.circular_sector}</div>
                    </div>
                    <div className="hidden md:block w-16 shrink-0">
                      <div className="text-[11px] text-[#111010]/45">Members</div>
                      <div className="text-[12px] text-[#111010]/75 [font-variant-numeric:tabular-nums]">{club.memberCount}</div>
                    </div>
                    <div className="hidden lg:block w-28 shrink-0">
                      <div className="text-[11px] text-[#111010]/45">Last seen</div>
                      <div className="text-[12px] text-[#111010]/75">{relativeSeen(club.lastSeenAt)}</div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(club)}
                        aria-label={`Edit ${club.name}`}
                        title="Edit this club"
                        className={`p-1.5 rounded-md hover:bg-[#E6F1FA] ${editing === club.id ? 'bg-[#E6F1FA] text-[#005FA3]' : 'text-[#111010]/50'}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setConfirmDelete(confirmDelete === club.id ? null : club.id);
                          setEditing(null);
                        }}
                        aria-label={`Delete ${club.name}`}
                        title="Delete this club"
                        className={`p-1.5 rounded-md hover:bg-[#FBE9EC] ${confirmDelete === club.id ? 'bg-[#FBE9EC] text-[#9B1C31]' : 'text-[#111010]/50'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {editing === club.id && (
                    <div className="bg-[#F7FAFC] px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="block text-[11px] font-semibold text-[#111010]/60 mb-1">Club name</span>
                        <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full hai-input px-3 py-2 text-[13px]" />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] font-semibold text-[#111010]/60 mb-1">School</span>
                        <select value={editForm.schoolId} onChange={(e) => setEditForm({ ...editForm, schoolId: e.target.value })} className="w-full hai-input px-3 py-2 text-[13px]">
                          {schools.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} — {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="block text-[11px] font-semibold text-[#111010]/60 mb-1">One-line description</span>
                        <input value={editForm.tagline} onChange={(e) => setEditForm({ ...editForm, tagline: e.target.value })} className="w-full hai-input px-3 py-2 text-[13px]" />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] font-semibold text-[#111010]/60 mb-1">Circular sector</span>
                        <input value={editForm.circularSector} onChange={(e) => setEditForm({ ...editForm, circularSector: e.target.value })} className="w-full hai-input px-3 py-2 text-[13px]" />
                      </label>
                      <div className="sm:col-span-2 flex items-center gap-2">
                        <button onClick={() => saveEdit(club)} disabled={busy} className="hai-btn-primary px-4 py-2 text-[12px] font-bold disabled:opacity-40">
                          Save changes
                        </button>
                        <button onClick={() => setEditing(null)} className="px-3 py-2 text-[12px] font-semibold text-[#111010]/60 hover:underline">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {confirmDelete === club.id && (
                    <div className="bg-[#FBE9EC] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[12px] text-[#9B1C31]">
                        Delete <strong>{club.name}</strong>?
                        {club.memberCount > 0 && ` Its ${club.memberCount} ${club.memberCount === 1 ? 'member' : 'members'} will become unassigned.`}{' '}
                        This cannot be undone.
                      </p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 text-[12px] font-semibold text-[#111010]/60 hover:underline">
                          Keep club
                        </button>
                        <button onClick={() => removeClub(club)} disabled={busy} className="px-4 py-2 rounded-full bg-[#9B1C31] text-white text-[12px] font-bold disabled:opacity-40">
                          Delete permanently
                        </button>
                      </div>
                    </div>
                  )}

                  {open && (
                    <div className="bg-[#F7FAFC] px-5 py-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[12px] font-bold text-[#0B2C4D]">
                          {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
                        </h3>
                        <div className="flex items-center gap-2">
                          <label htmlFor={`add-${club.id}`} className="text-[11px] text-[#111010]/55">
                            Add someone
                          </label>
                          <select
                            id={`add-${club.id}`}
                            value=""
                            onChange={(e) => addMember(club, e.target.value)}
                            disabled={busy || unassigned.length === 0}
                            className="hai-input px-2.5 py-1.5 text-[12px] max-w-[220px] disabled:opacity-50"
                          >
                            <option value="">{unassigned.length === 0 ? 'Everyone is in a club' : 'Choose a person'}</option>
                            {unassigned.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.full_name} — {p.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {club.members.length === 0 ? (
                        <p className="text-[12px] text-[#111010]/55 py-2">Nobody is assigned to this club yet.</p>
                      ) : (
                        <ul className="divide-y divide-[#0B2C4D]/8 bg-white rounded-lg border border-[#0B2C4D]/10">
                          {club.members.map((m) => (
                            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                              <div className="min-w-0">
                                <div className="text-[12px] font-semibold text-[#111010] truncate">{m.full_name}</div>
                                <div className="text-[11px] text-[#111010]/55 truncate">{m.email}</div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                  <div className="text-[11px] text-[#111010]/55">{relativeSeen(m.lastSeenAt)}</div>
                                  <div className="text-[10px] text-[#111010]/40 [font-variant-numeric:tabular-nums]">
                                    {m.hoursLast7Days} h this week
                                  </div>
                                </div>
                                {!m.hasPassword && (
                                  <span className="text-[10px] text-[#8A5A00] bg-[#FDF3DC] border border-[#8A5A00]/20 rounded-full px-2 py-0.5">
                                    No password
                                  </span>
                                )}
                                <button
                                  onClick={() => removeMember(m)}
                                  disabled={busy}
                                  aria-label={`Remove ${m.full_name} from ${club.name}`}
                                  title="Remove from club"
                                  className="p-1.5 rounded-md hover:bg-[#FBE9EC] text-[#111010]/40 disabled:opacity-40"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {unassigned.length > 0 && (
        <Panel title="Not in a club" meta={`${unassigned.length} people`}>
          <ul className="divide-y divide-[#0B2C4D]/8 -mx-0">
            {unassigned.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[#111010] truncate">{p.full_name}</div>
                  <div className="text-[11px] text-[#111010]/55 truncate">{p.email}</div>
                </div>
                <span className="text-[11px] text-[#8A5A00] inline-flex items-center gap-1 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" /> Unassigned
                </span>
              </li>
            ))}
          </ul>
          <p className="px-5 pb-4 pt-2 text-[11px] text-[#111010]/50">
            Expand a club above and use “Add someone” to place them.
          </p>
        </Panel>
      )}
    </div>
  );
}
