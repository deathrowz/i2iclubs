import { createClient } from '@supabase/supabase-js';
import {
  PILOT_SCHOOLS,
  PILOT_CLUBS,
  DEMO_USERS,
  INITIAL_IMPACT_LOGS,
  APPROVED_HISTORICAL_LOGS,
} from '../src/lib/store/seed-data';

const SUPABASE_URL = 'http://localhost:8000'; // OCI self-hosted Supabase (local dev); production: https://161.118.247.101.sslip.io
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyMTc0MzI5LCJleHAiOjE5NDk4NTQzMjl9.LAXhM4gFBYfOr5bStoFMn77aK0MdRu6z6fVHrzzInPc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function populate() {
  console.log('🌱 Seeding OCI self-hosted Supabase database...');

  // 1. Schools
  console.log(`Inserting ${PILOT_SCHOOLS.length} schools...`);
  const { error: schoolErr } = await supabase.from('schools').upsert(
    PILOT_SCHOOLS.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      district: s.district,
      city: s.city,
      campus_lat: s.campus_lat,
      campus_lng: s.campus_lng,
      campus_radius_meters: s.campus_radius_meters,
      institutional_commitment_score: s.institutional_commitment_score,
      penalty_points_deducted: s.penalty_points_deducted,
      seed_funding_base_usd: s.seed_funding_base_usd,
      seed_funding_topoff_usd: s.seed_funding_topoff_usd,
    }))
  );
  if (schoolErr) throw schoolErr;
  console.log('✅ Schools inserted.');

  // 2. Clubs
  console.log(`Inserting ${PILOT_CLUBS.length} clubs...`);
  const { error: clubErr } = await supabase.from('clubs').upsert(
    PILOT_CLUBS.map((c) => ({
      id: c.id,
      school_id: c.school_id,
      school_name: c.school_name,
      school_code: c.school_code,
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      circular_sector: c.circular_sector,
      business_model_canvas: c.business_model_canvas,
      org_chart: c.org_chart,
      approved_milestones: c.approved_milestones,
      criteria_baseline: c.criteria_baseline,
      active_members_count: c.active_members_count,
      last_submission_at: c.last_submission_at,
    }))
  );
  if (clubErr) throw clubErr;
  console.log('✅ Clubs inserted.');

  // 3. User Profiles
  console.log(`Inserting ${DEMO_USERS.length} user profiles...`);
  const { error: userErr } = await supabase.from('user_profiles').upsert(
    DEMO_USERS.map((u) => ({
      id: u.id,
      email: u.email,
      login_code: u.login_code,
      role: u.role,
      organization: u.organization,
      full_name: u.full_name,
      school_id: u.school_id,
      school_name: u.school_name,
      school_code: u.school_code,
      club_id: u.club_id,
      club_name: u.club_name,
      assigned_club_ids: u.assigned_club_ids || [],
      telegram_username: u.telegram_username,
    }))
  );
  if (userErr) throw userErr;
  console.log('✅ User profiles inserted.');

  // 4. Impact Logs
  const allLogs = [...INITIAL_IMPACT_LOGS, ...APPROVED_HISTORICAL_LOGS];
  console.log(`Inserting ${allLogs.length} impact logs...`);
  const { error: logErr } = await supabase.from('impact_logs').upsert(
    allLogs.map((l) => ({
      id: l.id,
      club_id: l.club_id,
      club_name: l.club_name,
      school_id: l.school_id,
      school_name: l.school_name,
      school_code: l.school_code,
      student_id: l.student_id,
      student_name: l.student_name,
      telegram_username: l.telegram_username,
      file_name: l.file_name,
      mime_type: l.mime_type,
      is_uncompressed_document: l.is_uncompressed_document,
      s3_url: l.s3_url,
      s3_key: l.s3_key,
      exif_timestamp: l.exif_timestamp,
      exif_lat: l.exif_lat,
      exif_lng: l.exif_lng,
      exif_device_make: l.exif_device_make,
      exif_device_model: l.exif_device_model,
      campus_distance_meters: l.campus_distance_meters,
      on_campus_verified: l.on_campus_verified,
      activity_title: l.activity_title,
      activity_category: l.activity_category,
      description: l.description,
      waste_kg: l.waste_kg,
      revenue_usd: l.revenue_usd,
      co2_saved_kg: l.co2_saved_kg,
      is_final_pitch: l.is_final_pitch,
      transaction_type: l.transaction_type,
      status: l.status,
      teacher_reviewer_id: l.teacher_reviewer_id,
      teacher_reviewer_name: l.teacher_reviewer_name,
      teacher_reviewed_at: l.teacher_reviewed_at,
      teacher_notes: l.teacher_notes,
      random_audit_selected: l.random_audit_selected,
      audit_status: l.audit_status,
      audit_flagged_fraud: l.audit_flagged_fraud,
      expert_reviewer_id: l.expert_reviewer_id,
      expert_reviewer_name: l.expert_reviewer_name,
      expert_reviewed_at: l.expert_reviewed_at,
      expert_notes: l.expert_notes,
      criteria_scores: l.criteria_scores,
      points_awarded: l.points_awarded,
      penalty_points: l.penalty_points,
      resubmission_count: l.resubmission_count,
      resubmission_parent_log_id: l.parent_log_id || null,
      rejection_reason: l.rejection_reason,
      verified_documents: l.verified_documents || [],
      scored_via_telegram: Boolean(l.scored_via_telegram),
      telegram_dossier_sent_to_experts: Boolean(l.telegram_dossier_sent_to_experts),
      created_at: l.created_at,
      updated_at: l.updated_at,
    }))
  );
  if (logErr) throw logErr;
  console.log('✅ Impact logs inserted.');

  console.log('\n🎉 SUPABASE SEEDING COMPLETE!');
}

populate().catch((err) => {
  console.error('❌ Populate failed:', err);
  process.exit(1);
});
