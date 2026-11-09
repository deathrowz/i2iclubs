import assert from 'node:assert/strict';
import type { UserProfile } from '../../types/domain';
import { matchesLoginIdentifier, toPublicProfile, toPublicSnapshot } from '../auth/identity';

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

const FORBIDDEN_LOG_KEYS = [
  'student_id',
  'student_name',
  'telegram_username',
  'phone_number',
  's3_url',
  's3_key',
  'exif_lat',
  'exif_lng',
  'exif_device_make',
  'exif_device_model',
];

function snapshotFixture() {
  return {
    users: [teacher, student],
    impactLogs: [
      {
        id: 'log-1',
        club_id: 'club-01',
        school_id: 'SCH-01',
        student_id: 'usr-student-01',
        student_name: 'Child Name',
        telegram_username: 'child_handle',
        phone_number: '94771234502',
        s3_url: 'https://storage.example/proof.jpg',
        s3_key: 'proofs/log-1.jpg',
        exif_lat: 6.9,
        exif_lng: 79.8,
        exif_device_make: 'Samsung',
        waste_kg: 12,
        revenue_usd: 40,
        status: 'approved',
      },
    ],
    whatsappMessages: [{ whatsapp_number: '94771234502', student_name: 'Child Name' }],
    telegramMessages: [{ telegram_username: 'child_handle' }],
    auditLogs: [{ actor_name: 'Mr Teacher' }],
    clubs: [
      {
        id: 'club-01',
        org_chart: [
          { id: 'club-01-org-1', role_title: 'Student President (CEO)', holder_name: 'Kavindu Perera' },
        ],
      },
    ],
    leaderboard: [
      {
        rank: 1,
        club: {
          id: 'club-01',
          org_chart: [{ id: 'club-01-org-1', role_title: 'Student President (CEO)', holder_name: 'Kavindu Perera' }],
        },
      },
    ],
  };
}

function runRedaction() {
  const pub = toPublicSnapshot(snapshotFixture());

  // Users keep only display fields.
  assert.equal('email' in pub.users[0], false);
  assert.equal('login_code' in pub.users[0], false);

  // Impact logs keep the facts the leaderboard and club pages need, and drop
  // everything that identifies a child or locates a proof file.
  const row = pub.impactLogs[0] as Record<string, unknown>;
  for (const key of FORBIDDEN_LOG_KEYS) {
    assert.equal(key in row, false, `impact log leaked ${key}`);
  }
  assert.equal(row.waste_kg, 12);
  assert.equal(row.status, 'approved');

  // Message history and the audit trail are removed for anonymous callers.
  assert.deepEqual(pub.whatsappMessages, []);
  assert.deepEqual(pub.telegramMessages, []);
  assert.deepEqual(pub.auditLogs, []);

  // Org charts keep the role but not the student's name.
  const member = (pub.clubs[0].org_chart as Record<string, unknown>[])[0];
  assert.equal('holder_name' in member, false);
  assert.equal(member.role_title, 'Student President (CEO)');

  // Leaderboard rows embed the club, so its org chart is redacted there too.
  const rowClub = (pub.leaderboard[0] as { club: { org_chart: Record<string, unknown>[] } }).club;
  assert.equal('holder_name' in rowClub.org_chart[0], false, 'leaderboard org chart leaked a name');

  // The source snapshot is not mutated.
  const source = snapshotFixture();
  toPublicSnapshot(source);
  assert.equal(source.impactLogs[0].student_name, 'Child Name');
}

function run() {
  runRedaction();

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

  console.log('✅ Identity: public projection, snapshot redaction and login identifier matching pass.');
}

run();
