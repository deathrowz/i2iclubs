import {
  ActivityCategory,
  AuditLogEntry,
  Club,
  CriteriaScores,
  DocumentCategory,
  GamificationConfig,
  ImpactLog,
  School,
  TelegramBotOutboundMessage,
  UserProfile,
  VerifiedDocument,
  WhatsAppBotOutboundMessage,
} from '@/types/domain';
import {
  APPROVED_HISTORICAL_LOGS,
  DEMO_USERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_GAMIFICATION_CONFIG,
  INITIAL_IMPACT_LOGS,
  INITIAL_TELEGRAM_MESSAGES,
  INITIAL_WHATSAPP_MESSAGES,
  PILOT_CLUBS,
  PILOT_SCHOOLS,
} from './seed-data';
import {
  calculateMacroTransactionPoints,
  calculateMicroTransactionPoints,
  classifyTransactionTier,
  computeSchoolLeaderboard,
  detectHealthAndRiskAnomalies,
  formatLkr,
  shouldSelectForRandomExpertAudit,
} from '@/lib/gamification/engine';
import { calculateDistanceMeters } from '@/lib/exif/parser';
import { getSupabaseBrowserClient, getSupabaseServiceClient } from '@/lib/supabase/client';

export interface ActivityPing {
  userId: string;
  at: string; // ISO timestamp
}

interface PlatformState {
  schools: School[];
  clubs: Club[];
  users: UserProfile[];
  impactLogs: ImpactLog[];
  auditLogs: AuditLogEntry[];
  gamificationConfig: GamificationConfig;
  whatsappMessages: WhatsAppBotOutboundMessage[];
  telegramMessages: TelegramBotOutboundMessage[];
  activity: ActivityPing[];
}

// Global singleton in-memory store (persists across hot-reloads in dev & API requests)
const globalForStore = globalThis as unknown as {
  __CIRCULAR_PLATFORM_STORE__?: PlatformState;
};

function createInitialState(): PlatformState {
  const initialMessages = structuredClone(INITIAL_WHATSAPP_MESSAGES);
  return {
    schools: structuredClone(PILOT_SCHOOLS),
    clubs: structuredClone(PILOT_CLUBS),
    users: structuredClone(DEMO_USERS),
    impactLogs: [
      ...structuredClone(INITIAL_IMPACT_LOGS),
      ...structuredClone(APPROVED_HISTORICAL_LOGS),
    ],
    auditLogs: structuredClone(INITIAL_AUDIT_LOGS),
    gamificationConfig: structuredClone(INITIAL_GAMIFICATION_CONFIG),
    whatsappMessages: initialMessages,
    telegramMessages: initialMessages,
    activity: [],
  };
}

export function getPlatformStore(): PlatformState {
  if (!globalForStore.__CIRCULAR_PLATFORM_STORE__) {
    globalForStore.__CIRCULAR_PLATFORM_STORE__ = createInitialState();
  }
  return globalForStore.__CIRCULAR_PLATFORM_STORE__;
}

/**
 * Robust async log lookup: checks in-memory platform store, and falls back to Supabase
 * if the log was created by the Telegram Bot or another browser session.
 */
export async function findOrFetchImpactLog(logId: string): Promise<ImpactLog | undefined> {
  const store = getPlatformStore();
  let log = store.impactLogs.find((l) => l.id === logId);
  if (log) return log;

  // Fallback to Supabase PostgreSQL
  try {
    const supabase = getSupabaseServiceClient() || getSupabaseBrowserClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('impact_logs')
        .select('*')
        .eq('id', logId)
        .maybeSingle();

      if (!error && data) {
        const parsedLog: ImpactLog = {
          ...data,
          parent_log_id: data.resubmission_parent_log_id || data.parent_log_id,
          verified_documents: data.verified_documents || [],
          waste_kg: Number(data.waste_kg ?? 0),
          revenue_usd: Number(data.revenue_usd ?? 0),
          co2_saved_kg: Number(data.co2_saved_kg ?? 0),
          points_awarded: Number(data.points_awarded ?? 0),
          penalty_points: Number(data.penalty_points ?? 0),
          campus_distance_meters: Number(data.campus_distance_meters ?? 0),
          resubmission_count: Number(data.resubmission_count ?? 0),
        };
        // Unshift into in-memory store so subsequent synchronous lookups and leaderboard calculations succeed
        store.impactLogs.unshift(parsedLog);
        return parsedLog;
      }
    }
  } catch (err) {
    console.warn(`Supabase fallback lookup error for log "${logId}":`, err);
  }

  return undefined;
}

/**
 * Helper to dispatch a WhatsApp notification to the student
 */
export async function dispatchWhatsAppNotification(params: {
  chatId: number | string;
  studentName: string;
  telegramUsername?: string;
  whatsappNumber?: string;
  logId?: string;
  type: WhatsAppBotOutboundMessage['type'];
  text: string;
}): Promise<WhatsAppBotOutboundMessage> {
  const store = getPlatformStore();
  const message: WhatsAppBotOutboundMessage = {
    id: `wa-out-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    chat_id: params.chatId,
    student_name: params.studentName,
    whatsapp_number: params.whatsappNumber || (typeof params.chatId === 'string' ? params.chatId : undefined),
    telegram_username: params.telegramUsername,
    log_id: params.logId,
    type: params.type,
    text: params.text,
    sent_at: new Date().toISOString(),
  };

  store.whatsappMessages.unshift(message);
  store.telegramMessages.unshift(message);

  return message;
}

export const dispatchTelegramNotification = dispatchWhatsAppNotification;

/**
 * STEP 1: Student Submission via WhatsApp Cloud API (Creates `status: 'pending'` record)
 */
export async function createStudentImpactSubmission(params: {
  actorId: string;
  clubId: string;
  fileName: string;
  mimeType: string;
  isUncompressedDocument: boolean;
  s3Url: string;
  s3Key: string;
  exifTimestamp: string;
  exifLat: number;
  exifLng: number;
  exifDeviceMake?: string;
  exifDeviceModel?: string;
  activityTitle: string;
  activityCategory: ActivityCategory;
  description: string;
  wasteKg: number;
  revenueUsd: number;
  isFinalPitch?: boolean;
  parentLogId?: string;
}): Promise<ImpactLog> {
  const store = getPlatformStore();

  // Enforce Metadata Constraint: Must be uncompressed Document with EXIF timestamp & GPS
  if (!params.isUncompressedDocument) {
    throw new Error(
      'METADATA_CONSTRAINT_VIOLATION: Photos must be sent as uncompressed Documents/Files to preserve EXIF data.'
    );
  }

  if (
    !params.exifTimestamp ||
    typeof params.exifLat !== 'number' ||
    typeof params.exifLng !== 'number' ||
    isNaN(params.exifLat) ||
    isNaN(params.exifLng)
  ) {
    throw new Error(
      'EXIF_MISSING: Submission rejected because EXIF timestamp or GPS coordinates are missing.'
    );
  }

  const club = store.clubs.find((c) => c.id === params.clubId);
  if (!club) {
    throw new Error(`Club not found: ${params.clubId}`);
  }

  const school = store.schools.find((s) => s.id === club.school_id);
  if (!school) {
    throw new Error(`School not found for club: ${club.id}`);
  }

  const student =
    store.users.find((u) => u.id === params.actorId || u.auth_user_id === params.actorId) ||
    store.users.find((u) => u.role === 'student' && u.school_id === school.id) ||
    store.users.find((u) => u.role === 'student') ||
    store.users[0];

  // Anti-tamper constraint: Students can only submit activities for their assigned school
  if (student && student.role === 'student' && student.school_id && student.school_id !== school.id) {
    throw new Error(
      `RBAC_SCHOOL_SCOPE_VIOLATION: Student ${student.full_name} (${student.school_id}) cannot submit activities for a different school (${school.name} - ${school.id}).`
    );
  }

  // Check if this is a Step 5 Resolution Loop Resubmission
  let resubmissionCount = 0;
  if (params.parentLogId) {
    const parentLog = await findOrFetchImpactLog(params.parentLogId);
    if (!parentLog) {
      throw new Error('Parent submission not found for resubmission.');
    }
    if (parentLog.status !== 'rejected') {
      throw new Error('RESOLUTION_LOOP_VIOLATION: Only rejected submissions can be resubmitted.');
    }
    if (parentLog.resubmission_count >= 1) {
      throw new Error(
        'RESOLUTION_LOOP_LIMIT_EXCEEDED: Only a single (1) resubmission attempt is permitted per rejected transaction.'
      );
    }
    parentLog.resubmission_count += 1;
    resubmissionCount = 1;
  }

  const rawDistance = calculateDistanceMeters(
    params.exifLat,
    params.exifLng,
    school.campus_lat,
    school.campus_lng
  );
  const campusDistance = Math.min(99999999, Math.round(rawDistance * 100) / 100);
  const onCampusVerified = campusDistance <= school.campus_radius_meters;

  const transactionType = classifyTransactionTier({
    revenueUsd: params.revenueUsd,
    isFinalPitch: params.isFinalPitch,
    activityCategory: params.activityCategory,
    config: store.gamificationConfig,
  });

  const now = new Date().toISOString();
  const newLog: ImpactLog = {
    id: `log-${Date.now().toString().slice(-5)}`,
    club_id: club.id,
    club_name: club.name,
    school_id: school.id,
    school_name: school.name,
    school_code: school.code,
    student_id: student.id,
    student_name: student.full_name.split(' (')[0],
    phone_number: student.phone_number || '94771234501',
    whatsapp_message_id: `wamid.${Date.now()}`,
    uploaded_via_whatsapp: true,
    telegram_username: student.telegram_username || '@student_entrepreneur',
    telegram_message_id: `tg-msg-${Date.now().toString().slice(-4)}`,
    file_name: params.fileName,
    mime_type: params.mimeType,
    is_uncompressed_document: true,
    s3_url: params.s3Url,
    s3_key: params.s3Key,
    exif_timestamp: params.exifTimestamp,
    exif_lat: params.exifLat,
    exif_lng: params.exifLng,
    exif_device_make: params.exifDeviceMake || 'Samsung',
    exif_device_model: params.exifDeviceModel || 'Galaxy A54 (RAW Document)',
    campus_distance_meters: campusDistance,
    on_campus_verified: onCampusVerified,
    activity_title: params.activityTitle,
    activity_category: params.activityCategory,
    description: params.description,
    waste_kg: Number(params.wasteKg),
    revenue_usd: Number(params.revenueUsd),
    co2_saved_kg: Number((Number(params.wasteKg) * 2.4).toFixed(2)),
    is_final_pitch: Boolean(params.isFinalPitch || params.activityCategory === 'final_funding_pitch'),
    transaction_type: transactionType,
    status: 'pending',
    random_audit_selected: false,
    audit_status: 'not_selected',
    audit_flagged_fraud: false,
    points_awarded: 0,
    penalty_points: 0,
    resubmission_count: resubmissionCount,
    parent_log_id: params.parentLogId,
    created_at: now,
    updated_at: now,
  };

  store.impactLogs.unshift(newLog);
  club.last_submission_at = now;

  // Trigger-equivalent Audit Log entry
  const auditEntry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    impact_log_id: newLog.id,
    club_id: club.id,
    club_name: club.name,
    school_id: school.id,
    school_name: school.name,
    school_code: school.code,
    actor_id: student.id,
    actor_name: student.full_name,
    actor_role: 'student',
    action_type: resubmissionCount > 0 ? 'STUDENT_RESUBMISSION' : 'STUDENT_SUBMISSION_CREATED',
    previous_status: resubmissionCount > 0 ? 'rejected' : null,
    new_status: 'pending',
    points_delta: 0,
    reason_or_notes:
      resubmissionCount > 0
        ? `Student resubmitted transaction (Attempt 1/1) for "${newLog.activity_title}"`
        : `Submitted via WhatsApp as ${transactionType.toUpperCase()} transaction (${formatLkr(newLog.revenue_usd)} sales, ${newLog.waste_kg} kg waste)`,
    metadata: {
      transaction_type: transactionType,
      exif_lat: newLog.exif_lat,
      exif_lng: newLog.exif_lng,
      campus_distance_meters: campusDistance,
      on_campus_verified: onCampusVerified,
      s3_key: newLog.s3_key,
    },
    created_at: now,
  };
  store.auditLogs.unshift(auditEntry);

  // Sync to Supabase if configured (skip in unit test runs to prevent test pollution)
  if (process.env.IS_UNIT_TEST !== 'true') {
    try {
      const supabase = getSupabaseServiceClient();
      if (supabase) {
        const { error: insertError } = await supabase.from('impact_logs').insert({
          id: newLog.id,
          club_id: newLog.club_id,
          club_name: newLog.club_name,
          school_id: newLog.school_id,
          school_name: newLog.school_name,
          school_code: newLog.school_code,
          student_id: newLog.student_id,
          student_name: newLog.student_name,
          telegram_username: newLog.telegram_username,
          telegram_message_id: newLog.telegram_message_id,
          file_name: newLog.file_name,
          mime_type: newLog.mime_type,
          is_uncompressed_document: true,
          s3_url: newLog.s3_url,
          s3_key: newLog.s3_key,
          exif_timestamp: newLog.exif_timestamp,
          exif_lat: newLog.exif_lat,
          exif_lng: newLog.exif_lng,
          exif_device_make: newLog.exif_device_make,
          exif_device_model: newLog.exif_device_model,
          campus_distance_meters: newLog.campus_distance_meters,
          on_campus_verified: newLog.on_campus_verified,
          activity_title: newLog.activity_title,
          activity_category: newLog.activity_category,
          description: newLog.description,
          waste_kg: newLog.waste_kg,
          revenue_usd: newLog.revenue_usd,
          co2_saved_kg: newLog.co2_saved_kg,
          is_final_pitch: newLog.is_final_pitch,
          transaction_type: newLog.transaction_type,
          status: newLog.status,
          random_audit_selected: newLog.random_audit_selected,
          audit_status: newLog.audit_status,
          audit_flagged_fraud: newLog.audit_flagged_fraud,
          points_awarded: newLog.points_awarded,
          penalty_points: newLog.penalty_points,
          resubmission_count: newLog.resubmission_count,
          resubmission_parent_log_id: newLog.parent_log_id,
          created_at: newLog.created_at,
          updated_at: newLog.updated_at,
        });
        if (insertError) {
          console.error('❌ Supabase impact_logs insert error:', insertError);
        } else {
          console.log(`✅ Synced new submission "${newLog.id}" to Supabase!`);
        }
      }
    } catch (err) {
      console.warn('Supabase sync exception:', err);
    }
  }

  await dispatchTelegramNotification({
    chatId: student.telegram_user_id || 800101,
    studentName: newLog.student_name,
    telegramUsername: newLog.telegram_username || '@student',
    logId: newLog.id,
    type: 'SUBMISSION_RECEIPT',
    text: `✅ SUBMISSION LOGGED (${newLog.id}): "${newLog.activity_title}"\n• Tier: ${newLog.transaction_type.toUpperCase()} (${formatLkr(newLog.revenue_usd)} / ${newLog.waste_kg} kg)\n• School GPS Check: ${newLog.campus_distance_meters}m from ${newLog.school_code} (${
      newLog.on_campus_verified ? 'Verified On-Campus' : 'Off-Campus Flag'
    })\n• Status: PENDING Teacher Review`,
  });

  return newLog;
}

/**
 * STEP 2 & STEP 3: Supervising Teacher Endorsement (Tier 1 Local Audit) & Threshold Routing
 * Enforces strict RBAC: Teacher can ONLY update logs belonging to their own school!
 */
export async function performTeacherReview(params: {
  actorId: string;
  logId: string;
  decision: 'approve' | 'reject' | 'flag';
  notesOrReason?: string;
  forceRandomAuditSelection?: boolean; // Optional override for deterministic testing
}): Promise<{ log: ImpactLog; auditEntry: AuditLogEntry }> {
  const store = getPlatformStore();
  const actor = store.users.find((u) => u.id === params.actorId || u.auth_user_id === params.actorId);

  if (!actor || actor.role !== 'teacher') {
    throw new Error(
      'RBAC_ROLE_VIOLATION: Only a Supervising Teacher (Tier 1 Approver) can execute Tier 1 local endorsement.'
    );
  }

  const log = await findOrFetchImpactLog(params.logId);
  if (!log) {
    throw new Error(`Impact log not found: ${params.logId}`);
  }

  // STRICT RBAC SCHOOL CHECK (Matches Supabase RLS policy)
  if (actor.school_id !== log.school_id) {
    throw new Error(
      `RBAC_SCHOOL_SCOPE_VIOLATION: Teacher ${actor.full_name} belongs to school ${actor.school_id} and is strictly prohibited by Row-Level Security from modifying logs belonging to ${log.school_name} (${log.school_id}).`
    );
  }

  if (log.status !== 'pending' && log.status !== 'flagged') {
    throw new Error(`Invalid state transition: Log ${log.id} is currently '${log.status}'.`);
  }

  const previousStatus = log.status;
  const now = new Date().toISOString();
  log.teacher_reviewer_id = actor.id;
  log.teacher_reviewer_name = actor.full_name.split(' (')[0];
  log.teacher_reviewed_at = now;
  log.updated_at = now;

  let actionType: AuditLogEntry['action_type'] = 'TEACHER_APPROVED_MICRO';
  let pointsDelta = 0;
  let auditReason = params.notesOrReason || '';

  if (params.decision === 'approve') {
    log.teacher_notes =
      params.notesOrReason || 'Confirmed student activity occurred on school premises with valid EXIF.';

    // STEP 3: Threshold Routing (The Safeguard)
    if (log.transaction_type === 'macro') {
      // Macro-Transaction (>Rs. 15,000 sales or final pitch) -> Route to Expert Panel!
      // Teacher CANNOT award leaderboard points directly on Macro transactions.
      log.status = 'pending_expert_review';
      log.points_awarded = 0;
      actionType = 'TEACHER_ENDORSED_MACRO_ROUTED';
      auditReason = `Teacher endorsed Macro-Transaction (${formatLkr(log.revenue_usd)} sales). Routed to National Expert Panel (status: pending_expert_review).`;
    } else {
      // Micro-Transaction -> Automatically post points to Leaderboard + 10% Random Audit Roll
      const awarded = calculateMicroTransactionPoints({
        wasteKg: log.waste_kg,
        revenueUsd: log.revenue_usd,
        onCampusVerified: log.on_campus_verified,
      });
      log.status = 'approved';
      log.points_awarded = awarded;
      pointsDelta = awarded;

      const selectedForAudit =
        typeof params.forceRandomAuditSelection === 'boolean'
          ? params.forceRandomAuditSelection
          : shouldSelectForRandomExpertAudit(store.gamificationConfig.micro_audit_sample_rate);

      log.random_audit_selected = selectedForAudit;
      log.audit_status = selectedForAudit ? 'pending_audit' : 'not_selected';
      actionType = 'TEACHER_APPROVED_MICRO';
      auditReason = selectedForAudit
        ? `Teacher approved Micro-Transaction (+${awarded} pts). Selected by 10% Random Safeguard for Expert Panel Audit.`
        : `Teacher approved Micro-Transaction (+${awarded} pts released to Leaderboard).`;
    }
  } else if (params.decision === 'reject') {
    // STEP 5: Resolution Loop
    if (!params.notesOrReason || params.notesOrReason.trim().length < 4) {
      throw new Error(
        'RESOLUTION_LOOP_VIOLATION: A specific rejection reason is required to notify the student via WhatsApp.'
      );
    }
    log.status = 'rejected';
    log.rejection_reason = params.notesOrReason.trim();
    log.points_awarded = 0;
    actionType = 'SUBMISSION_REJECTED_RESOLUTION_LOOP';
    auditReason = `Teacher rejected submission: "${log.rejection_reason}"`;

    const remainingAttempts = Math.max(0, 1 - log.resubmission_count);
    const tgText =
      remainingAttempts > 0
        ? `⚠️ RESOLUTION LOOP (Tier 1 Teacher Rejection): Your submission "${log.activity_title}" (${log.id}) was rejected by ${log.teacher_reviewer_name}.\n\nReason: "${log.rejection_reason}"\n\n👉 You have 1 single resubmission attempt allowed. Use /resubmit ${log.id} with a corrected uncompressed Document.`
        : `❌ FINAL REJECTION: Your resubmission "${log.activity_title}" (${log.id}) was rejected by ${log.teacher_reviewer_name}. Reason: "${log.rejection_reason}". Maximum resubmission attempts (1/1) reached.`;

    log.whatsapp_notification_sent = true;
    log.whatsapp_last_message = tgText;
    log.telegram_notification_sent = true;
    log.telegram_last_message = tgText;

    await dispatchTelegramNotification({
      chatId: 800101,
      studentName: log.student_name,
      telegramUsername: log.telegram_username || '@student',
      logId: log.id,
      type: 'REJECTION_RESOLUTION',
      text: tgText,
    });
  } else if (params.decision === 'flag') {
    log.status = 'flagged';
    log.teacher_notes = params.notesOrReason || 'Flagged by Supervising Teacher for anomalous data.';
    actionType = 'SUBMISSION_FLAGGED_FOR_INVESTIGATION';
    auditReason = log.teacher_notes;
  }

  const auditEntry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    impact_log_id: log.id,
    club_id: log.club_id,
    club_name: log.club_name,
    school_id: log.school_id,
    school_name: log.school_name,
    school_code: log.school_code,
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: 'teacher',
    action_type: actionType,
    previous_status: previousStatus,
    new_status: log.status,
    points_delta: pointsDelta,
    reason_or_notes: auditReason,
    metadata: {
      transaction_type: log.transaction_type,
      random_audit_selected: log.random_audit_selected,
      audit_status: log.audit_status,
      points_awarded: log.points_awarded,
    },
    created_at: now,
  };

  store.auditLogs.unshift(auditEntry);

  try {
    const supabase = getSupabaseServiceClient() || getSupabaseBrowserClient();
    if (supabase) {
      await supabase.from('impact_logs').update({
        status: log.status,
        teacher_reviewer_id: log.teacher_reviewer_id,
        teacher_reviewer_name: log.teacher_reviewer_name,
        teacher_reviewed_at: log.teacher_reviewed_at,
        teacher_notes: log.teacher_notes,
        points_awarded: log.points_awarded,
        random_audit_selected: log.random_audit_selected,
        audit_status: log.audit_status,
        rejection_reason: log.rejection_reason,
        updated_at: now,
      }).eq('id', log.id);
    }
  } catch (_) {}

  return { log, auditEntry };
}

/**
 * STEP 4, STEP 5 & PENALTY MECHANICS: Expert Panel / Admin Adjudication (Tier 2)
 * Handles:
 * 1. Macro-Transaction Final Scoring against the 6 criteria (`approve_macro` / `reject_macro`)
 * 2. 10% Random Micro-Transaction Audit (`audit_pass` / `audit_fraud` with school point deduction)
 */
export async function performExpertAdjudication(params: {
  actorId: string;
  logId: string;
  action: 'approve_macro' | 'reject_macro' | 'audit_pass' | 'audit_fraud';
  criteriaScores?: CriteriaScores;
  notesOrReason?: string;
}): Promise<{ log: ImpactLog; auditEntry: AuditLogEntry }> {
  const store = getPlatformStore();
  const actor = store.users.find((u) => u.id === params.actorId || u.auth_user_id === params.actorId);

  if (
    !actor ||
    (actor.role !== 'expert_admin' &&
      actor.role !== 'expert' &&
      actor.role !== 'super_admin' &&
      actor.role !== 'admin')
  ) {
    throw new Error(
      'RBAC_ROLE_VIOLATION: Only an Expert Panel or GIZ Super Admin can perform final scoring or random audits.'
    );
  }

  const log = await findOrFetchImpactLog(params.logId);
  if (!log) {
    throw new Error(`Impact log not found: ${params.logId}`);
  }

  const school = store.schools.find((s) => s.id === log.school_id);
  const previousStatus = log.status;
  const now = new Date().toISOString();

  log.expert_reviewer_id = actor.id;
  log.expert_reviewer_name = actor.full_name.split(' (')[0];
  log.expert_reviewed_at = now;
  log.updated_at = now;

  let actionType: AuditLogEntry['action_type'] = 'EXPERT_APPROVED_MACRO';
  let pointsDelta = 0;
  let auditReason = params.notesOrReason || '';

  if (params.action === 'approve_macro') {
    if (log.status !== 'pending_expert_review' && log.status !== 'flagged') {
      throw new Error(
        `Macro-transaction ${log.id} must be endorsed by a Supervising Teacher ('pending_expert_review') before Expert scoring.`
      );
    }

    const scores: CriteriaScores = params.criteriaScores || {
      relevance: 88,
      business: 85,
      feasibility: 86,
      student_ownership: 90,
      sustainability: 92,
      institutional_commitment: school?.institutional_commitment_score ?? 85,
    };

    const awarded = calculateMacroTransactionPoints({
      criteriaScores: scores,
      wasteKg: log.waste_kg,
      revenueUsd: log.revenue_usd,
      config: store.gamificationConfig,
    });

    log.criteria_scores = scores;
    log.status = 'approved';
    log.points_awarded = awarded;
    log.expert_notes =
      params.notesOrReason ||
      'Scored across all 6 core criteria; financial & environmental metrics verified.';
    pointsDelta = awarded;
    actionType = 'EXPERT_APPROVED_MACRO';
    auditReason = `Expert Panel approved Macro-Transaction and released +${awarded} points to Leaderboard.`;

    await dispatchTelegramNotification({
      chatId: 800101,
      studentName: log.student_name,
      telegramUsername: log.telegram_username || '@student',
      logId: log.id,
      type: 'APPROVAL_NOTICE',
      text: `🏆 MACRO-TRANSACTION APPROVED (${log.id}): Expert Panel scored "${log.activity_title}" and released +${awarded} pts to ${log.school_name}'s Leaderboard total!`,
    });
  } else if (params.action === 'reject_macro') {
    // STEP 5: Resolution Loop from Expert Panel stage
    if (!params.notesOrReason || params.notesOrReason.trim().length < 4) {
      throw new Error(
        'RESOLUTION_LOOP_VIOLATION: Expert Panel rejection requires a specific reason to send back to the student via WhatsApp.'
      );
    }

    log.status = 'rejected';
    log.rejection_reason = params.notesOrReason.trim();
    log.expert_notes = log.rejection_reason;
    log.points_awarded = 0;
    actionType = 'SUBMISSION_REJECTED_RESOLUTION_LOOP';
    auditReason = `Expert Panel rejected Macro-Transaction: "${log.rejection_reason}"`;

    const remainingAttempts = Math.max(0, 1 - log.resubmission_count);
    const tgText =
      remainingAttempts > 0
        ? `⚠️ RESOLUTION LOOP (Tier 2 Expert Panel Rejection): Your Macro-Transaction "${log.activity_title}" (${log.id}) was rejected by ${log.expert_reviewer_name}.\n\nReason: "${log.rejection_reason}"\n\n👉 You have 1 single resubmission attempt allowed via /resubmit ${log.id}.`
        : `❌ FINAL REJECTION: Macro-Transaction "${log.activity_title}" (${log.id}) was rejected. Maximum resubmission attempts (1/1) reached.`;

    log.whatsapp_notification_sent = true;
    log.whatsapp_last_message = tgText;
    log.telegram_notification_sent = true;
    log.telegram_last_message = tgText;

    await dispatchTelegramNotification({
      chatId: 800101,
      studentName: log.student_name,
      telegramUsername: log.telegram_username || '@student',
      logId: log.id,
      type: 'REJECTION_RESOLUTION',
      text: tgText,
    });
  } else if (params.action === 'audit_pass') {
    // 10% Random Micro Audit Passed
    log.audit_status = 'audit_passed';
    log.audit_flagged_fraud = false;
    log.expert_notes =
      params.notesOrReason || 'Random 10% micro-transaction audit verified clean.';
    actionType = 'EXPERT_AUDIT_PASSED';
    auditReason = log.expert_notes;
  } else if (params.action === 'audit_fraud') {
    // PENALTY MECHANICS: Flagged as fraudulent during random 10% micro audit!
    const previousPoints = log.points_awarded;
    const penalty = store.gamificationConfig.fraud_penalty_points;

    log.status = 'fraud_revoked';
    log.audit_status = 'fraud_confirmed';
    log.audit_flagged_fraud = true;
    log.points_awarded = 0;
    log.penalty_points = penalty;
    log.expert_notes =
      params.notesOrReason ||
      `Flagged as fraudulent during 10% random audit. Revoked ${previousPoints} pts and deducted -${penalty} penalty points from school.`;

    if (school) {
      school.penalty_points_deducted = Number(
        (school.penalty_points_deducted + penalty).toFixed(2)
      );
    }

    pointsDelta = -(previousPoints + penalty);
    actionType = 'EXPERT_AUDIT_FRAUD_PENALTY';
    auditReason = log.expert_notes;

    await dispatchTelegramNotification({
      chatId: 800101,
      studentName: log.student_name,
      telegramUsername: log.telegram_username || '@student',
      logId: log.id,
      type: 'FRAUD_PENALTY_NOTICE',
      text: `🚨 RANDOM AUDIT FRAUD PENALTY (${log.id}): The Expert Panel flagged Micro-Transaction "${log.activity_title}" as fraudulent during a random 10% audit.\n• Original +${previousPoints} pts revoked\n• Penalty Applied: -${penalty} pts deducted from ${log.school_name}'s Leaderboard score.\n• Notes: "${log.expert_notes}"`,
    });
  }

  const auditEntry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    impact_log_id: log.id,
    club_id: log.club_id,
    club_name: log.club_name,
    school_id: log.school_id,
    school_name: log.school_name,
    school_code: log.school_code,
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: 'expert_admin',
    action_type: actionType,
    previous_status: previousStatus,
    new_status: log.status,
    points_delta: Number(pointsDelta.toFixed(2)),
    reason_or_notes: auditReason,
    metadata: {
      transaction_type: log.transaction_type,
      audit_status: log.audit_status,
      audit_flagged_fraud: log.audit_flagged_fraud,
      points_awarded: log.points_awarded,
      penalty_points: log.penalty_points,
      criteria_scores: log.criteria_scores,
    },
    created_at: now,
  };

  store.auditLogs.unshift(auditEntry);

  try {
    const supabase = getSupabaseServiceClient() || getSupabaseBrowserClient();
    if (supabase) {
      await supabase.from('impact_logs').update({
        status: log.status,
        expert_reviewer_id: log.expert_reviewer_id,
        expert_reviewer_name: log.expert_reviewer_name,
        expert_reviewed_at: log.expert_reviewed_at,
        expert_notes: log.expert_notes,
        criteria_scores: log.criteria_scores,
        points_awarded: log.points_awarded,
        penalty_points: log.penalty_points,
        audit_status: log.audit_status,
        audit_flagged_fraud: log.audit_flagged_fraud,
        updated_at: now,
      }).eq('id', log.id);
    }
  } catch (_) {}

  return { log, auditEntry };
}

/**
 * TEACHER DOCUMENT VERIFICATION PIPELINE:
 * Once verified locally by the school's supervising teacher, the teacher uploads
 * the sales invoice, official receipt, or scale ticket via WhatsApp Cloud or web interface.
 * The system logs the document, marks the transaction, and automatically sends a review
 * package to the GIZ & National Expert Panel channel!
 */
export async function attachTeacherVerifiedDocumentToLog(params: {
  actorId: string;
  logId: string;
  docCategory: DocumentCategory;
  fileName: string;
  mimeType: string;
  s3Url: string;
  s3Key: string;
  verifiedAmountLkr?: number;
  notes?: string;
  uploadedViaTelegram?: boolean;
}): Promise<{ log: ImpactLog; document: VerifiedDocument; auditEntry: AuditLogEntry }> {
  const store = getPlatformStore();
  const actor = store.users.find((u) => u.id === params.actorId || u.auth_user_id === params.actorId);

  if (!actor || (actor.role !== 'teacher' && actor.role !== 'super_admin' && actor.role !== 'admin')) {
    throw new Error(
      'RBAC_ROLE_VIOLATION: Only a Supervising Teacher or GIZ Admin can upload verified school invoices/receipts.'
    );
  }

  const log = await findOrFetchImpactLog(params.logId);
  if (!log) {
    throw new Error(`Impact log not found: ${params.logId}`);
  }

  // If teacher, enforce school scope
  if (actor.role === 'teacher' && actor.school_id !== log.school_id) {
    throw new Error(
      `RBAC_SCHOOL_SCOPE_VIOLATION: Teacher ${actor.full_name} cannot upload invoices for ${log.school_name}.`
    );
  }

  const now = new Date().toISOString();
  const verifiedDoc: VerifiedDocument = {
    id: `doc-${Date.now().toString().slice(-6)}`,
    log_id: log.id,
    doc_category: params.docCategory,
    file_name: params.fileName,
    mime_type: params.mimeType,
    s3_url: params.s3Url,
    s3_key: params.s3Key,
    uploaded_by_role: actor.role,
    uploaded_by_id: actor.id,
    uploaded_by_name: actor.full_name.split(' (')[0],
    verified_by_teacher_id: actor.id,
    verified_by_teacher_name: actor.full_name.split(' (')[0],
    verified_amount_lkr: params.verifiedAmountLkr ?? (log.revenue_usd * 300),
    uploaded_via_whatsapp: true,
    uploaded_via_telegram: Boolean(params.uploadedViaTelegram),
    notes: params.notes || 'Verified by supervising teacher on school campus.',
    created_at: now,
  };

  if (!log.verified_documents) {
    log.verified_documents = [];
  }
  log.verified_documents.push(verifiedDoc);
  log.teacher_reviewer_id = actor.id;
  log.teacher_reviewer_name = actor.full_name.split(' (')[0];
  log.whatsapp_dossier_sent_to_experts = true;
  log.telegram_dossier_sent_to_experts = true;
  log.updated_at = now;

  // Create audit entry
  const auditEntry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    impact_log_id: log.id,
    club_id: log.club_id,
    club_name: log.club_name,
    school_id: log.school_id,
    school_name: log.school_name,
    school_code: log.school_code,
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: actor.role,
    action_type: 'TEACHER_UPLOADED_VERIFIED_DOCUMENT',
    previous_status: log.status,
    new_status: log.status,
    points_delta: 0,
    reason_or_notes: `Teacher uploaded verified ${params.docCategory.replace(/_/g, ' ')} (${params.fileName}) via WhatsApp. Forwarded to GIZ & National Expert Panel.`,
    metadata: {
      doc_id: verifiedDoc.id,
      doc_category: params.docCategory,
      s3_url: params.s3Url,
      verified_amount_lkr: verifiedDoc.verified_amount_lkr,
      uploaded_via_whatsapp: verifiedDoc.uploaded_via_whatsapp,
      uploaded_via_telegram: verifiedDoc.uploaded_via_telegram,
    },
    created_at: now,
  };

  store.auditLogs.unshift(auditEntry);

  // Dispatch notification to GIZ & Expert Panel in WhatsApp
  await dispatchWhatsAppNotification({
    chatId: '+94701234567', // GIZ & Expert Panel channel
    studentName: 'GIZ & National Expert Panel',
    telegramUsername: '@giz_cea_expert_panel',
    whatsappNumber: '+94701234567',
    logId: log.id,
    type: 'APPROVAL_NOTICE',
    text:
      `📋 GIZ & NATIONAL EXPERT VERIFICATION PACKAGE (${log.id}):\n` +
      `• School: ${log.school_name} (${log.school_code})\n` +
      `• Enterprise: ${log.club_name} — "${log.activity_title}"\n` +
      `• Verified Revenue: Rs. ${(verifiedDoc.verified_amount_lkr || 0).toLocaleString()} | Recycled: ${log.waste_kg} kg\n` +
      `• Document Attached: 📄 ${verifiedDoc.file_name} (${verifiedDoc.doc_category.replace(/_/g, ' ')})\n` +
      `• Teacher Endorser: ${verifiedDoc.verified_by_teacher_name}\n\n` +
      `⚖️ EXPERT REVIEW ACTION VIA WHATSAPP:\n` +
      `Reply to score this activity across the 6 criteria:\n` +
      `👉 /score ${log.id} <relevance> <business> <feasibility> <ownership> <sustainability> <commitment>\n` +
      `Example: /score ${log.id} 92 88 86 94 95 90\n` +
      `Or type /review ${log.id} for guided step-by-step scoring!`,
  });

  try {
    const supabase = getSupabaseServiceClient() || getSupabaseBrowserClient();
    if (supabase) {
      await supabase.from('impact_logs').update({
        verified_documents: log.verified_documents,
        whatsapp_dossier_sent_to_experts: true,
        telegram_dossier_sent_to_experts: log.telegram_dossier_sent_to_experts,
        updated_at: now,
      }).eq('id', log.id);
    }
  } catch (_) {}

  return { log, document: verifiedDoc, auditEntry };
}

/**
 * EXPERT TELEGRAM SCORING PIPELINE:
 * Experts review the invoice, sales receipt, and environmental data directly in Telegram.
 * When the expert submits their selection criteria scores via Telegram,
/**
 * EXPERT WHATSAPP SCORING PIPELINE:
 * Experts review the invoice, sales receipt, and environmental data directly in WhatsApp or web.
 * When the expert submits their selection criteria scores via WhatsApp,
 * points are calculated, posted to the Leaderboard, and reflected live on the Dashboard!
 */
export async function submitExpertScoresViaWhatsApp(params: {
  actorId: string;
  logId: string;
  criteriaScores: CriteriaScores;
  notesOrReason?: string;
}): Promise<{ log: ImpactLog; auditEntry: AuditLogEntry; pointsAwarded: number }> {
  const store = getPlatformStore();
  const actor = store.users.find((u) => u.id === params.actorId || u.auth_user_id === params.actorId);

  if (
    !actor ||
    (actor.role !== 'expert_admin' &&
      actor.role !== 'expert' &&
      actor.role !== 'super_admin' &&
      actor.role !== 'admin')
  ) {
    throw new Error(
      'RBAC_ROLE_VIOLATION: Only an Expert Panel member or GIZ Super Admin can submit selection criteria scores via WhatsApp.'
    );
  }

  const log = await findOrFetchImpactLog(params.logId);
  if (!log) {
    throw new Error(`Impact log not found: ${params.logId}`);
  }

  const previousStatus = log.status;
  const now = new Date().toISOString();

  const awardedPoints = calculateMacroTransactionPoints({
    criteriaScores: params.criteriaScores,
    wasteKg: log.waste_kg,
    revenueUsd: log.revenue_usd,
    config: store.gamificationConfig,
  });

  log.criteria_scores = params.criteriaScores;
  log.status = 'approved';
  log.points_awarded = awardedPoints;
  log.scored_via_whatsapp = true;
  log.scored_via_telegram = true;
  log.expert_reviewer_id = actor.id;
  log.expert_reviewer_name = actor.full_name.split(' (')[0];
  log.expert_reviewed_at = now;
  log.expert_notes =
    params.notesOrReason ||
    'Scored via WhatsApp Cloud API after reviewing teacher-verified sales invoice & environmental evidence.';
  log.updated_at = now;

  const auditEntry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    impact_log_id: log.id,
    club_id: log.club_id,
    club_name: log.club_name,
    school_id: log.school_id,
    school_name: log.school_name,
    school_code: log.school_code,
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: actor.role,
    action_type: 'EXPERT_SCORED_VIA_WHATSAPP',
    previous_status: previousStatus,
    new_status: 'approved',
    points_delta: awardedPoints,
    reason_or_notes: `Expert submitted criteria scores via WhatsApp: [${params.criteriaScores.relevance}, ${params.criteriaScores.business}, ${params.criteriaScores.feasibility}, ${params.criteriaScores.student_ownership}, ${params.criteriaScores.sustainability}, ${params.criteriaScores.institutional_commitment}]. Released +${awardedPoints} pts to ${log.school_name}.`,
    metadata: {
      criteria_scores: params.criteriaScores,
      scored_via_whatsapp: true,
      scored_via_telegram: true,
      points_awarded: awardedPoints,
      verified_documents_count: log.verified_documents?.length || 0,
    },
    created_at: now,
  };

  store.auditLogs.unshift(auditEntry);

  // Send confirmation to Student, Teacher, and GIZ
  await dispatchWhatsAppNotification({
    chatId: log.phone_number || 800101,
    studentName: log.student_name,
    telegramUsername: log.telegram_username || '@student',
    whatsappNumber: log.phone_number,
    logId: log.id,
    type: 'APPROVAL_NOTICE',
    text:
      `🏆 SELECTION CRITERIA SCORED VIA WHATSAPP (${log.id}):\n` +
      `• Evaluator: ${log.expert_reviewer_name} (National Expert Panel)\n` +
      `• School: ${log.school_name} — "${log.activity_title}"\n` +
      `• Criteria Scores: Relevance: ${params.criteriaScores.relevance} | Business: ${params.criteriaScores.business} | Feasibility: ${params.criteriaScores.feasibility} | Student Leadership: ${params.criteriaScores.student_ownership} | Sustainability: ${params.criteriaScores.sustainability} | School Support: ${params.criteriaScores.institutional_commitment}\n` +
      `• Points Released: +${awardedPoints} pts added to Leaderboard in real-time!\n` +
      `• Status: APPROVED on School Dashboard`,
  });

  try {
    const supabase = getSupabaseServiceClient() || getSupabaseBrowserClient();
    if (supabase) {
      await supabase.from('impact_logs').update({
        status: log.status,
        criteria_scores: log.criteria_scores,
        points_awarded: log.points_awarded,
        scored_via_whatsapp: true,
        scored_via_telegram: true,
        expert_reviewer_id: log.expert_reviewer_id,
        expert_reviewer_name: log.expert_reviewer_name,
        expert_reviewed_at: log.expert_reviewed_at,
        expert_notes: log.expert_notes,
        updated_at: now,
      }).eq('id', log.id);
    }
  } catch (_) {}

  return { log, auditEntry, pointsAwarded: awardedPoints };
}

/**
 * Updates Gamification Algorithm Weights & Thresholds (Expert Admin Only)
 */
export function updateGamificationConfig(params: {
  actorId: string;
  updates: Partial<GamificationConfig>;
}): GamificationConfig {
  const store = getPlatformStore();
  const actor = store.users.find((u) => u.id === params.actorId || u.auth_user_id === params.actorId);

  if (
    !actor ||
    (actor.role !== 'expert_admin' &&
      actor.role !== 'expert' &&
      actor.role !== 'super_admin' &&
      actor.role !== 'admin')
  ) {
    throw new Error(
      'RBAC_ROLE_VIOLATION: Only GIZ Super Admin or Expert Panel can modify the gamification algorithm.'
    );
  }

  store.gamificationConfig = {
    ...store.gamificationConfig,
    ...params.updates,
    updated_at: new Date().toISOString(),
  };

  return store.gamificationConfig;
}

/**
 * Returns full platform snapshot with computed Leaderboard and Health/Risk Alerts
 */
export function getFullPlatformSnapshot() {
  const store = getPlatformStore();
  const leaderboard = computeSchoolLeaderboard({
    schools: store.schools,
    clubs: store.clubs,
    impactLogs: store.impactLogs,
    config: store.gamificationConfig,
  });
  const healthAlerts = detectHealthAndRiskAnomalies({
    schools: store.schools,
    clubs: store.clubs,
    impactLogs: store.impactLogs,
  });

  return {
    schools: store.schools,
    clubs: store.clubs,
    users: store.users,
    impactLogs: store.impactLogs,
    auditLogs: store.auditLogs,
    gamificationConfig: store.gamificationConfig,
    whatsappMessages: store.whatsappMessages,
    telegramMessages: store.telegramMessages,
    leaderboard,
    healthAlerts,
  };
}

export const submitExpertScoresViaTelegram = submitExpertScoresViaWhatsApp;

/* ============================================================================
 * ACTIVITY TRACKING
 * A heartbeat records a ping per signed-in visit. Pings are persisted in
 * Postgres when a service key is configured, so "last seen" and "hours this
 * week" survive restarts; the in-memory list stays as a fallback for local
 * development and for graceful degradation when the database is unreachable.
 * ========================================================================== */

const ACTIVITY_RETENTION_DAYS = 30;
const ACTIVITY_READ_DAYS = 30;

export interface UserActivitySummary {
  lastSeenAt: string | null;
  hoursLast7Days: number;
  activeDaysLast7Days: number;
}

function summariseActivity(pings: ActivityPing[]): Record<string, UserActivitySummary> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const summaries: Record<string, UserActivitySummary> = {};
  const hourBuckets = new Map<string, Set<string>>();
  const dayBuckets = new Map<string, Set<string>>();

  for (const ping of pings) {
    const current = summaries[ping.userId] ?? {
      lastSeenAt: null,
      hoursLast7Days: 0,
      activeDaysLast7Days: 0,
    };
    if (!current.lastSeenAt || ping.at > current.lastSeenAt) current.lastSeenAt = ping.at;
    summaries[ping.userId] = current;

    if (ping.at >= sevenDaysAgo) {
      const day = ping.at.slice(0, 10);
      const hour = ping.at.slice(0, 13);
      if (!hourBuckets.has(ping.userId)) hourBuckets.set(ping.userId, new Set());
      if (!dayBuckets.has(ping.userId)) dayBuckets.set(ping.userId, new Set());
      hourBuckets.get(ping.userId)!.add(hour);
      dayBuckets.get(ping.userId)!.add(day);
    }
  }

  for (const [userId, hours] of hourBuckets) {
    summaries[userId].hoursLast7Days = hours.size;
    summaries[userId].activeDaysLast7Days = dayBuckets.get(userId)?.size ?? 0;
  }

  return summaries;
}

export async function recordActivity(userId: string): Promise<void> {
  const store = getPlatformStore();
  const at = new Date().toISOString();

  store.activity.push({ userId, at });
  const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  if (store.activity.length > 5000) {
    store.activity = store.activity.filter((p) => p.at >= cutoff);
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from('activity_pings').insert({ user_id: userId, at });
    if (error) {
      console.warn('[activity] insert failed, kept in memory only:', error.message);
    }
  } catch (err) {
    console.warn('[activity] insert threw, kept in memory only:', err);
  }
}

export async function getUserActivitySummaries(): Promise<Record<string, UserActivitySummary>> {
  const store = getPlatformStore();
  const supabase = getSupabaseServiceClient();

  if (supabase) {
    try {
      const since = new Date(Date.now() - ACTIVITY_READ_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('activity_pings')
        .select('user_id, at')
        .gte('at', since)
        .order('at', { ascending: false })
        .limit(20000);

      if (!error && Array.isArray(data)) {
        return summariseActivity(
          data.map((row: { user_id: string; at: string }) => ({ userId: row.user_id, at: row.at }))
        );
      }
      if (error) console.warn('[activity] read failed, using memory:', error.message);
    } catch (err) {
      console.warn('[activity] read threw, using memory:', err);
    }
  }

  return summariseActivity(store.activity);
}

/* ============================================================================
 * SCHOOL CLUB MANAGEMENT (Super Admin)
 * ========================================================================== */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function recountMembers(clubId: string): void {
  const store = getPlatformStore();
  const club = store.clubs.find((c) => c.id === clubId);
  if (!club) return;
  club.active_members_count = store.users.filter((u) => u.club_id === clubId).length;
}

export function createSchoolClub(params: {
  schoolId: string;
  name: string;
  tagline?: string;
  circularSector?: string;
  actorId: string;
}): Club {
  const store = getPlatformStore();
  const school = store.schools.find((s) => s.id === params.schoolId);
  if (!school) throw new Error('School not found.');

  const name = params.name.trim();
  if (name.length < 3) throw new Error('Club name needs at least 3 characters.');

  let slug = slugify(name);
  if (!slug) throw new Error('Club name must contain letters or numbers.');
  if (store.clubs.some((c) => c.slug === slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const club: Club = {
    id: `club-${Date.now().toString(36)}`,
    school_id: school.id,
    school_name: school.name,
    school_code: school.code,
    slug,
    name,
    tagline: params.tagline?.trim() || `Student circular enterprise at ${school.name}`,
    circular_sector: params.circularSector?.trim() || 'Circular Upcycling',
    business_model_canvas: {
      value_proposition: '',
      circular_feedstock: '',
      revenue_streams: [],
      cost_structure: [],
      customer_segments: [],
      environmental_kpi: '',
    },
    org_chart: [],
    approved_milestones: [],
    criteria_baseline: {
      relevance: 75,
      business: 70,
      feasibility: 75,
      student_ownership: 80,
      sustainability: 80,
      institutional_commitment: Math.round(school.institutional_commitment_score),
    },
    active_members_count: 0,
    last_submission_at: new Date().toISOString(),
  };

  store.clubs.push(club);
  store.auditLogs.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    impact_log_id: '',
    club_id: club.id,
    club_name: club.name,
    school_id: school.id,
    school_name: school.name,
    school_code: school.code,
    actor_id: params.actorId,
    actor_name: 'Super Administrator',
    actor_role: 'super_admin',
    action_type: 'STUDENT_SUBMISSION_CREATED',
    previous_status: null,
    new_status: 'pending',
    points_delta: 0,
    reason_or_notes: `Club created: ${club.name} at ${school.name}`,
    metadata: { event: 'CLUB_CREATED', slug: club.slug },
    created_at: new Date().toISOString(),
  });

  return club;
}

export function updateSchoolClub(
  clubId: string,
  patch: { name?: string; tagline?: string; circularSector?: string; schoolId?: string }
): Club {
  const store = getPlatformStore();
  const club = store.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Club not found.');

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 3) throw new Error('Club name needs at least 3 characters.');
    club.name = name;
  }
  if (patch.tagline !== undefined) club.tagline = patch.tagline.trim();
  if (patch.circularSector !== undefined) club.circular_sector = patch.circularSector.trim();

  if (patch.schoolId !== undefined && patch.schoolId !== club.school_id) {
    const school = store.schools.find((s) => s.id === patch.schoolId);
    if (!school) throw new Error('School not found.');
    club.school_id = school.id;
    club.school_name = school.name;
    club.school_code = school.code;
  }

  return club;
}

export function deleteSchoolClub(clubId: string): { unassignedUsers: number } {
  const store = getPlatformStore();
  const index = store.clubs.findIndex((c) => c.id === clubId);
  if (index === -1) throw new Error('Club not found.');

  let unassignedUsers = 0;
  for (const user of store.users) {
    if (user.club_id === clubId) {
      user.club_id = null;
      user.club_name = undefined;
      unassignedUsers += 1;
    }
  }

  store.clubs.splice(index, 1);
  return { unassignedUsers };
}

export function assignUserToClub(userId: string, clubId: string | null): UserProfile {
  const store = getPlatformStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error('User not found.');

  const previousClubId = user.club_id ?? null;

  if (clubId === null) {
    user.club_id = null;
    user.club_name = undefined;
  } else {
    const club = store.clubs.find((c) => c.id === clubId);
    if (!club) throw new Error('Club not found.');
    user.club_id = club.id;
    user.club_name = club.name;
    // Keep the school in step with the club — a club always belongs to one school.
    user.school_id = club.school_id;
    user.school_name = club.school_name;
    user.school_code = club.school_code;
  }

  if (previousClubId) recountMembers(previousClubId);
  if (clubId) recountMembers(clubId);

  return user;
}
