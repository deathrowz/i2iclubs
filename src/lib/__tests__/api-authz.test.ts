import assert from 'node:assert/strict';
import type { ImpactLog, UserProfile } from '../../types/domain';
import { bindActor, scopeImpactLogs } from '../auth/scope';

type LogFixture = Pick<ImpactLog, 'id' | 'school_id' | 'club_id'>;

const logs = [
  { id: 'log-a', school_id: 'SCH-01', club_id: 'club-01' },
  { id: 'log-b', school_id: 'SCH-01', club_id: 'club-02' },
  { id: 'log-c', school_id: 'SCH-02', club_id: 'club-03' },
] as LogFixture[] as ImpactLog[];

const ids = (rows: ImpactLog[]) => rows.map((r) => r.id);

function run() {
  // 1. The actor is always the verified profile, never the body's actorId.
  const bound = bindActor({ actorId: 'usr-spoofed', logId: 'log-1' }, { id: 'usr-teacher-01' });
  assert.equal(bound.actorId, 'usr-teacher-01');
  assert.equal(bound.logId, 'log-1');

  const unbound = bindActor({ logId: 'log-2' }, { id: 'usr-student-01' });
  assert.equal(unbound.actorId, 'usr-student-01');

  // 2. Admins and experts read every log.
  for (const role of ['super_admin', 'admin', 'expert_admin', 'expert'] as const) {
    const profile = { role, school_id: null } as Pick<UserProfile, 'role' | 'school_id'>;
    assert.deepEqual(ids(scopeImpactLogs(profile, logs)), ['log-a', 'log-b', 'log-c'], role);
  }

  // 3. Teachers and students read only their own school.
  for (const role of ['teacher', 'student'] as const) {
    const profile = { role, school_id: 'SCH-02' } as Pick<UserProfile, 'role' | 'school_id'>;
    assert.deepEqual(ids(scopeImpactLogs(profile, logs)), ['log-c'], role);
  }

  // 4. A teacher or student with no school sees nothing rather than everything.
  assert.deepEqual(
    scopeImpactLogs({ role: 'teacher', school_id: null }, logs),
    [],
    'schoolless teacher'
  );

  // 5. Mentors read only their assigned clubs; no assignment means no logs.
  assert.deepEqual(
    ids(scopeImpactLogs({ role: 'mentor', school_id: null, assigned_club_ids: ['club-02'] }, logs)),
    ['log-b']
  );
  assert.deepEqual(
    scopeImpactLogs({ role: 'mentor', school_id: null }, logs),
    []
  );

  // 6. An unrecognised role sees nothing.
  assert.deepEqual(
    scopeImpactLogs({ role: 'visitor' as never, school_id: 'SCH-01' }, logs),
    []
  );

  console.log('✅ API authorisation: actor binding and log scoping pass.');
}

run();
