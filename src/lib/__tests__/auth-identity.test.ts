import assert from 'node:assert/strict';
import type { UserProfile } from '../../types/domain';
import { matchesLoginIdentifier, toPublicProfile } from '../auth/identity';

const teacher = {
  id: 'usr-teacher-01',
  auth_user_id: 'b3f1c2d4-0000-4000-8000-000000000001',
  email: 'teacher.sch01@example.lk',
  login_code: 'SCH-01-TEACHER',
  phone_number: '94771234501',
  organization: 'Private org',
  full_name: 'Test Teacher',
  role: 'teacher',
  school_id: 'SCH-01',
  school_name: 'School One',
  school_code: 'SCH-01',
  club_id: null,
  telegram_user_id: 12345,
} as unknown as UserProfile;

const student = {
  id: 'usr-student-01',
  email: 'student.club01@example.lk',
  login_code: 'CLUB-01-STUDENT',
  phone_number: '+94 77 123 4502',
  full_name: 'Test Student',
  role: 'student',
  school_id: 'SCH-01',
  club_id: 'club-01',
  club_name: 'Club One',
} as unknown as UserProfile;

function run() {
  // 1. The public projection keeps only display fields.
  const pub = toPublicProfile(teacher);
  assert.deepEqual(Object.keys(pub).sort(), [
    'club_id',
    'club_name',
    'full_name',
    'id',
    'role',
    'school_id',
    'school_name',
  ]);
  for (const secret of ['email', 'login_code', 'phone_number', 'auth_user_id', 'telegram_user_id', 'organization']) {
    assert.equal(secret in pub, false, `leaked ${secret}`);
  }

  // 2. Each documented identifier resolves to its user.
  assert.equal(matchesLoginIdentifier(teacher, 'teacher.sch01@example.lk'), true, 'email');
  assert.equal(matchesLoginIdentifier(teacher, 'sch-01-teacher'), true, 'login code');
  assert.equal(matchesLoginIdentifier(teacher, 'sch-01'), true, 'school code');
  assert.equal(matchesLoginIdentifier(student, '+94771234502'), true, 'phone, normalised');
  assert.equal(matchesLoginIdentifier(student, '94 77 123 4502'), true, 'phone, spaced');
  assert.equal(matchesLoginIdentifier(student, 'club-01-club'), true, '-club alias');

  // 3. Internal ids and auth ids are no longer identifiers.
  assert.equal(matchesLoginIdentifier(teacher, 'usr-teacher-01'), false, 'internal id');
  assert.equal(matchesLoginIdentifier(teacher, teacher.auth_user_id!), false, 'auth user id');

  // 4. Non-matches and empty input.
  assert.equal(matchesLoginIdentifier(teacher, 'someone@else.lk'), false);
  assert.equal(matchesLoginIdentifier(student, ''), false);
  assert.equal(matchesLoginIdentifier(student, '+94779999999'), false);

  console.log('✅ Identity: public projection and login identifier matching pass.');
}

run();
