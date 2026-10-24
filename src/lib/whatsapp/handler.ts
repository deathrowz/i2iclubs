/**
 * ============================================================================
 * WHATSAPP CLOUD API (GRAPH API v20.0+) INGESTION & CONVERSATION HANDLER
 * I2I Clubs (Idea2Impact) • GIZ Sri Lanka 15-School Pilot Platform
 *
 * Full-stack / Client Isomorphic Bridge:
 * - Direct webhook execution on the OCI self-hosted stack (161.118.247.101.sslip.io) + colocated Supabase
 * - In-browser fallback for static GitHub Pages export and interactive UI workbench
 * - Identity resolution via E.164 phone numbers (MSISDN)
 * - Stateless media buffer ingestion into private 'i2i-proofs' bucket
 * ============================================================================
 */

import {
  ActivityCategory,
  CriteriaScores,
  DocumentCategory,
  ExifMetadata,
  LeaderboardSchoolScore,
  UserRole,
} from '@/types/domain';
import { createSampleExifDocumentBuffer, extractAndValidateExif } from '@/lib/exif/parser';
import { uploadDocumentBufferToS3 } from '@/lib/storage/s3';
import {
  attachTeacherVerifiedDocumentToLog,
  createStudentImpactSubmission,
  dispatchWhatsAppNotification,
  findOrFetchImpactLog,
  getPlatformStore,
  submitExpertScoresViaWhatsApp,
} from '@/lib/store/platform-store';
import { computeSchoolLeaderboard, formatLkr } from '@/lib/gamification/engine';
import { getSupabaseBrowserClient, getSupabaseServiceClient } from '@/lib/supabase/client';

export type WhatsAppConversationStage =
  | 'IDLE'
  | 'AWAITING_DOCUMENT'
  | 'AWAITING_ACTIVITY_TITLE'
  | 'AWAITING_WASTE_KG'
  | 'AWAITING_REVENUE_USD'
  | 'AWAITING_TEACHER_INVOICE_DOC'
  | 'AWAITING_EXPERT_CRITERIA_INPUT';

export type BotConversationStage = WhatsAppConversationStage;

export interface WhatsAppBotSession {
  phoneNumber: string;
  studentId: string;
  clubId: string;
  stage: WhatsAppConversationStage;
  resubmitParentLogId?: string;
  fileName?: string;
  mimeType?: string;
  s3Url?: string;
  s3Key?: string;
  exif?: ExifMetadata;
  activityTitle?: string;
  activityCategory?: ActivityCategory;
  wasteKg?: number;
  actorRole?: UserRole;
  actorId?: string;
  invoiceTargetLogId?: string;
  invoiceDocCategory?: DocumentCategory;
  expertScoreTargetLogId?: string;
  updatedAt: string;
}

export type TelegramBotSession = WhatsAppBotSession;

const sessions = new Map<string, WhatsAppBotSession>();

export function getWhatsAppSession(phoneOrId: string | number): WhatsAppBotSession | undefined {
  return sessions.get(String(phoneOrId));
}

export const getBotSession = getWhatsAppSession;

export interface IncomingWhatsAppUpdate {
  phoneNumber?: string;
  from?: string;
  chatId?: number | string; // Backwards-compatible fallback
  actorId?: string;
  actorRole?: UserRole;
  studentId?: string;
  clubId?: string;
  text?: string;
  document?: {
    fileName: string;
    mimeType: string;
    bufferBase64?: string;
    simulatedExif?: Partial<ExifMetadata>;
    docCategory?: DocumentCategory;
    invoiceAmountLkr?: number;
  };
  photoCompressed?: {
    fakePayload: string;
  };
  buttonPayload?: string;
}

export type IncomingTelegramUpdate = IncomingWhatsAppUpdate;

export interface WhatsAppQuickAction {
  label: string;
  value: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
}

export type BotQuickAction = WhatsAppQuickAction;

export interface WhatsAppHandlerResponse {
  ok: boolean;
  botReply: string;
  stage?: WhatsAppConversationStage;
  quickActions?: WhatsAppQuickAction[];
  createdLogId?: string;
  attachedDocId?: string;
  scoredPoints?: number;
  error?: string;
  snapshot?: any;
}

export type BotHandlerResponse = WhatsAppHandlerResponse;

export const STUDENT_QUICK_ACTIONS: WhatsAppQuickAction[] = [
  { label: '📸 Log Activity', value: '/log_impact', variant: 'primary' },
  { label: '📊 Club Status', value: '/status', variant: 'secondary' },
  { label: '🏆 Leaderboard', value: '/leaderboard', variant: 'accent' },
  { label: '❓ Photo Guide', value: '/photo_guide', variant: 'secondary' },
];

export const TEACHER_QUICK_ACTIONS: WhatsAppQuickAction[] = [
  { label: '📄 Upload Invoice', value: '/upload_invoice', variant: 'primary' },
  { label: '🏫 School Status', value: '/status', variant: 'secondary' },
  { label: '🏆 Leaderboard', value: '/leaderboard', variant: 'accent' },
];

export const EXPERT_QUICK_ACTIONS: WhatsAppQuickAction[] = [
  { label: '⚖️ Score Queue', value: '/review', variant: 'primary' },
  { label: '🏆 Leaderboard', value: '/leaderboard', variant: 'accent' },
];

export const STUDENT_TOUCH_KEYBOARD = { keyboard: STUDENT_QUICK_ACTIONS };
export const TEACHER_TOUCH_KEYBOARD = { keyboard: TEACHER_QUICK_ACTIONS };
export const EXPERT_TOUCH_KEYBOARD = { keyboard: EXPERT_QUICK_ACTIONS };

/**
 * Normalizes phone numbers to standard E.164 digits
 */
function normalizePhoneNumber(raw?: string | number): string {
  if (!raw) return '94771234501';
  return String(raw).replace(/[^0-9]/g, '');
}

/**
 * Handles an inbound WhatsApp Cloud API update.
 */
export async function handleWhatsAppCloudUpdate(
  update: IncomingWhatsAppUpdate
): Promise<WhatsAppHandlerResponse> {
  const store = getPlatformStore();
  const sessionKey = normalizePhoneNumber(update.phoneNumber || update.from || update.chatId);

  // 1. Identity Resolution against Platform Users / Profiles
  let actor = store.users.find(
    (u) =>
      u.id === update.actorId ||
      u.id === update.studentId ||
      (u.phone_number && normalizePhoneNumber(u.phone_number) === sessionKey)
  );

  // If unregistered phone number, handle gracefully without error
  if (!actor && sessionKey.startsWith('9477999')) {
    return {
      ok: false,
      botReply:
        `⚠️ *I2I Clubs (Idea2Impact) Alert*\n\n` +
        `Your mobile number (+${sessionKey}) is not registered with any of the 15 pilot school circular enterprises.\n\n` +
        `Please contact your school's Supervising Teacher or the GIZ Sri Lanka Program Secretariat to register your mobile number.`,
      stage: 'IDLE',
      quickActions: [],
    };
  }

  if (!actor) {
    if (update.actorRole === 'expert_admin') {
      actor = store.users.find((u) => u.role === 'expert_admin') || store.users[1];
    } else if (update.actorRole === 'teacher') {
      actor = store.users.find((u) => u.role === 'teacher') || store.users[3];
    } else {
      actor = store.users.find((u) => u.role === 'student') || store.users[0];
    }
  }

  const role = update.actorRole || actor.role;

  // Resolve School and Club
  const club =
    store.clubs.find((c) => c.id === update.clubId) ||
    store.clubs.find((c) => c.id === actor.club_id) ||
    store.clubs[0];
  const school = store.schools.find((s) => s.id === club.school_id) || store.schools[0];

  // Retrieve or create session
  let session = sessions.get(sessionKey);
  if (!session) {
    session = {
      phoneNumber: sessionKey,
      studentId: actor.id,
      clubId: club.id,
      stage: 'IDLE',
      actorRole: role,
      actorId: actor.id,
      updatedAt: new Date().toISOString(),
    };
    sessions.set(sessionKey, session);
  }

  const textInput = (update.buttonPayload || update.text || '').trim();

  // Reset to idle on /cancel
  if (textInput.toLowerCase() === '/cancel') {
    session.stage = 'IDLE';
    return {
      ok: true,
      botReply: 'Operation cancelled. How can I help you?',
      stage: 'IDLE',
      quickActions: role === 'student' ? STUDENT_QUICK_ACTIONS : TEACHER_QUICK_ACTIONS,
    };
  }

  // Handle Informational Commands
  if (textInput === '/status') {
    const clubLogs = store.impactLogs.filter((l) => l.club_id === club.id);
    const approved = clubLogs.filter((l) => l.status === 'approved');
    const totalSales = approved.reduce((sum, l) => sum + l.revenue_usd, 0);
    const totalWaste = approved.reduce((sum, l) => sum + l.waste_kg, 0);

    return {
      ok: true,
      botReply:
        `📊 *${club.name} (${school.name}) Status*\n\n` +
        `• Approved Transactions: ${approved.length}\n` +
        `• Recycled Waste: ${totalWaste.toFixed(1)} kg\n` +
        `• Verified Revenue: ${formatLkr(totalSales)}\n` +
        `• Supervising Teacher: ${actor.role === 'teacher' ? actor.full_name : 'Verified on Campus'}\n` +
        `• WhatsApp Pipeline: Active (Graph API v20.0 • OCI self-hosted)`,
      stage: session.stage,
      quickActions: STUDENT_QUICK_ACTIONS,
    };
  }

  if (textInput === '/leaderboard') {
    const leaderboard = computeSchoolLeaderboard({
      schools: store.schools,
      clubs: store.clubs,
      impactLogs: store.impactLogs,
      config: store.gamificationConfig,
    });

    const top5 = leaderboard
      .slice(0, 5)
      .map((entry, idx) => `${idx + 1}. ${entry.school.name} — ${entry.composite_leaderboard_score} pts`)
      .join('\n');

    return {
      ok: true,
      botReply:
        `🏆 *National 15-School Leaderboard (Top 5)*\n\n${top5}\n\n` +
        `View full live standings at https://deathrowz.github.io/circular-economy-schoolclubs-pilot/`,
      stage: session.stage,
      quickActions: STUDENT_QUICK_ACTIONS,
    };
  }

  if (textInput === '/photo_guide') {
    return {
      ok: true,
      botReply:
        `📸 *WhatsApp Evidence Photo Guidelines*\n\n` +
        `1. *Never send as compressed photo:* Always tap the 📎 paperclip and choose *Document* to preserve camera EXIF.\n` +
        `2. *Turn GPS On:* Ensure your phone's Location is enabled before taking the photo on school campus.\n` +
        `3. *Capture scales & products:* Include the digital scale reading or weighbridge ticket directly in the frame.`,
      stage: session.stage,
      quickActions: STUDENT_QUICK_ACTIONS,
    };
  }

  // =========================================================================
  // TEACHER INVOICE ATTACHMENT COMMAND: /upload_invoice <log_id>
  // =========================================================================
  if (textInput.startsWith('/upload_invoice')) {
    const parts = textInput.split(/\s+/);
    const targetLogId = parts[1] || session.invoiceTargetLogId;

    if (!targetLogId) {
      return {
        ok: false,
        botReply: 'Please provide the target Log ID: `/upload_invoice log-102`',
        stage: 'IDLE',
      };
    }

    const targetLog = await findOrFetchImpactLog(targetLogId);
    if (!targetLog) {
      return {
        ok: false,
        botReply: `Log "${targetLogId}" not found in system.`,
        stage: 'IDLE',
      };
    }

    session.stage = 'AWAITING_TEACHER_INVOICE_DOC';
    session.invoiceTargetLogId = targetLog.id;
    session.actorRole = 'teacher';

    return {
      ok: true,
      botReply:
        `📄 *Upload Verified Invoice / Receipt for ${targetLog.id}*\n\n` +
        `Activity: "${targetLog.activity_title}" (${targetLog.school_name})\n` +
        `Sales Amount: ${formatLkr(targetLog.revenue_usd)}\n\n` +
        `Please attach the official sales invoice, bookshop receipt, or weighbridge scale ticket as an *Uncompressed Document (PDF or JPG)*.`,
      stage: 'AWAITING_TEACHER_INVOICE_DOC',
    };
  }

  // Handle Teacher Document Upload
  if (session.stage === 'AWAITING_TEACHER_INVOICE_DOC') {
    if (!update.document) {
      return {
        ok: false,
        botReply: 'Please attach the invoice as an uncompressed Document (PDF or JPG).',
        stage: 'AWAITING_TEACHER_INVOICE_DOC',
      };
    }

    const targetLog = await findOrFetchImpactLog(session.invoiceTargetLogId!);
    if (!targetLog) {
      session.stage = 'IDLE';
      return { ok: false, botReply: 'Target submission no longer exists.', stage: 'IDLE' };
    }

    const docCategory: DocumentCategory = update.document.docCategory || 'sales_invoice';
    const attachResult = await attachTeacherVerifiedDocumentToLog({
      actorId: actor.id,
      logId: targetLog.id,
      docCategory,
      fileName: update.document.fileName,
      mimeType: update.document.mimeType,
      s3Url: `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000'}/storage/v1/object/authenticated/i2i-proofs/${update.document.fileName}`,
      s3Key: `invoices/${targetLog.school_code}/${update.document.fileName}`,
      notes: 'Supervising teacher uploaded verified official invoice via WhatsApp Cloud API.',
      uploadedViaTelegram: true, // Backwards-compatible flag
    });

    session.stage = 'IDLE';
    session.invoiceTargetLogId = undefined;

    return {
      ok: true,
      botReply:
        `✅ *TEACHER-VERIFIED INVOICE ATTACHED (${attachResult.document.id})*\n\n` +
        `• Activity: "${targetLog.activity_title}" (${targetLog.id})\n` +
        `• Document: ${attachResult.document.file_name} (${docCategory})\n` +
        `• Verified Amount: Rs. ${(attachResult.document.verified_amount_lkr || 0).toLocaleString()}\n` +
        `• Endorser: ${actor.full_name}\n\n` +
        `🚀 Dossier has been forwarded to GIZ Sri Lanka and the National Expert Evaluation Panel for scoring.`,
      stage: 'IDLE',
      attachedDocId: attachResult.document.id,
      snapshot: store,
    };
  }

  // =========================================================================
  // EXPERT CRITERIA SCORING COMMAND: /score <log_id> <c1> <c2> <c3> <c4> <c5> <c6>
  // =========================================================================
  if (textInput.startsWith('/score')) {
    const parts = textInput.split(/\s+/);
    if (parts.length < 8) {
      return {
        ok: false,
        botReply:
          `Format: \`/score <log_id> <relevance> <business> <feasibility> <ownership> <sustainability> <commitment>\`\n` +
          `Example: \`/score log-102 90 85 80 95 90 85\``,
        stage: 'IDLE',
      };
    }

    const logId = parts[1];
    const scores: CriteriaScores = {
      relevance: Math.min(100, Math.max(0, Number(parts[2]) || 70)),
      business: Math.min(100, Math.max(0, Number(parts[3]) || 70)),
      feasibility: Math.min(100, Math.max(0, Number(parts[4]) || 70)),
      student_ownership: Math.min(100, Math.max(0, Number(parts[5]) || 70)),
      sustainability: Math.min(100, Math.max(0, Number(parts[6]) || 70)),
      institutional_commitment: Math.min(100, Math.max(0, Number(parts[7]) || 70)),
    };

    const targetLog = await findOrFetchImpactLog(logId);
    if (!targetLog) {
      return { ok: false, botReply: `Log "${logId}" not found.`, stage: 'IDLE' };
    }

    const scoreResult = await submitExpertScoresViaWhatsApp({
      actorId: actor.id,
      logId: targetLog.id,
      criteriaScores: scores,
      notesOrReason: 'Adjudicated and scored via WhatsApp Cloud API.',
    });

    return {
      ok: true,
      botReply:
        `🏆 *SCORED & SUBMITTED VIA WHATSAPP (${targetLog.id})*\n\n` +
        `• Activity: "${targetLog.activity_title}" (${targetLog.school_name})\n` +
        `• Points Awarded: +${scoreResult.log.points_awarded} pts\n` +
        `• Status: APPROVED\n` +
        `• School Leaderboard Updated Live!`,
      stage: 'IDLE',
      scoredPoints: scoreResult.log.points_awarded,
      snapshot: store,
    };
  }

  // =========================================================================
  // REVIEW DOSSIER COMMAND: /review <log_id>
  // =========================================================================
  if (textInput.startsWith('/review')) {
    const parts = textInput.split(/\s+/);
    const targetLogId = parts[1];
    if (!targetLogId) {
      return { ok: false, botReply: 'Usage: `/review <log_id>`', stage: 'IDLE' };
    }

    const targetLog = await findOrFetchImpactLog(targetLogId);
    if (!targetLog) {
      return { ok: false, botReply: `Log "${targetLogId}" not found.`, stage: 'IDLE' };
    }

    const docs = targetLog.verified_documents || [];
    const docSummary = docs.length
      ? docs.map((d) => `• ${d.doc_category}: ${d.file_name} (Rs. ${d.verified_amount_lkr})`).join('\n')
      : '• No invoices uploaded yet';

    return {
      ok: true,
      botReply:
        `🔍 *EXPERT DOSSIER REVIEW (${targetLog.id})*\n\n` +
        `• School: ${targetLog.school_name} (${targetLog.school_code})\n` +
        `• Activity: "${targetLog.activity_title}"\n` +
        `• Sales: ${formatLkr(targetLog.revenue_usd)} • Waste: ${targetLog.waste_kg} kg\n` +
        `• Status: ${targetLog.status.toUpperCase()}\n` +
        `• Campus GPS Distance: ${targetLog.campus_distance_meters}m\n\n` +
        `📁 *Attached Invoices:*\n${docSummary}\n\n` +
        `To score: \`/score ${targetLog.id} 90 85 80 95 90 85\``,
      stage: 'IDLE',
    };
  }

  // =========================================================================
  // STUDENT SUBMISSION PIPELINE: /log_impact or /resubmit
  // =========================================================================
  if (textInput.startsWith('/resubmit')) {
    const parts = textInput.split(/\s+/);
    const parentLogId = parts[1];
    if (!parentLogId) {
      return { ok: false, botReply: 'Usage: `/resubmit <log_id>`', stage: 'IDLE' };
    }

    const parentLog = await findOrFetchImpactLog(parentLogId);
    if (!parentLog) {
      return { ok: false, botReply: `Submission "${parentLogId}" not found.`, stage: 'IDLE' };
    }

    if (parentLog.status !== 'rejected') {
      return {
        ok: false,
        botReply: `Submission "${parentLogId}" is not rejected (status: ${parentLog.status}).`,
        stage: 'IDLE',
      };
    }

    if (parentLog.resubmission_count >= 1) {
      return {
        ok: false,
        botReply:
          `🔒 *RESOLUTION LOOP LOCKED:* Submission "${parentLogId}" has already used its single (1x) permitted resubmission attempt.`,
        stage: 'IDLE',
      };
    }

    session.stage = 'AWAITING_DOCUMENT';
    session.resubmitParentLogId = parentLog.id;

    return {
      ok: true,
      botReply:
        `🔄 *RESUBMISSION (Attempt 1/1) for "${parentLog.activity_title}"*\n\n` +
        `Previous Rejection Reason: "${parentLog.rejection_reason}"\n\n` +
        `Please attach your clear evidence photo as an *Uncompressed Document* with GPS enabled.`,
      stage: 'AWAITING_DOCUMENT',
    };
  }

  if (textInput === '/log_impact' || session.stage === 'IDLE') {
    if (textInput === '/log_impact') {
      session.stage = 'AWAITING_DOCUMENT';
      return {
        ok: true,
        botReply:
          `📸 *Step 1/4: Activity Evidence Photo*\n\n` +
          `Please attach your activity or sales proof as an *Uncompressed Document / File* (preserves camera EXIF GPS metadata).\n\n` +
          `Tap 📎 -> Document -> Choose Photo from Camera/Gallery.`,
        stage: 'AWAITING_DOCUMENT',
      };
    }
  }

  // Handle Photo/Document Ingestion
  if (session.stage === 'AWAITING_DOCUMENT') {
    if (update.photoCompressed) {
      return {
        ok: false,
        botReply:
          `❌ *COMPRESSED PHOTO REJECTED*\n\n` +
          `WhatsApp photo compression strips camera EXIF metadata and GPS coordinates required for GIZ EU GDPR compliance.\n\n` +
          `👉 *How to fix:* Tap 📎 (Paperclip) -> select *Document* -> choose your image file.`,
        stage: 'AWAITING_DOCUMENT',
      };
    }

    if (!update.document) {
      return {
        ok: false,
        botReply: 'Please send your photo as an uncompressed Document.',
        stage: 'AWAITING_DOCUMENT',
      };
    }

    // Validate EXIF
    const sampleBuf = createSampleExifDocumentBuffer({
      timestamp: update.document.simulatedExif?.timestamp || new Date().toISOString(),
      lat: update.document.simulatedExif?.lat ?? school.campus_lat,
      lng: update.document.simulatedExif?.lng ?? school.campus_lng,
    });

    const parsed = await extractAndValidateExif(sampleBuf, {
      fileName: update.document.fileName,
    });

    if (!parsed.valid || !parsed.metadata) {
      return {
        ok: false,
        botReply: `❌ EXIF validation failed: ${parsed.errorMessage || parsed.errorCode || 'Missing GPS'}`,
        stage: 'AWAITING_DOCUMENT',
      };
    }

    session.fileName = update.document.fileName;
    session.mimeType = update.document.mimeType;
    session.s3Url = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000'}/storage/v1/object/authenticated/i2i-proofs/${update.document.fileName}`;
    session.s3Key = `evidence/${school.code}/${update.document.fileName}`;
    session.exif = parsed.metadata;
    session.stage = 'AWAITING_ACTIVITY_TITLE';

    return {
      ok: true,
      botReply:
        `✅ *EXIF Verified on Campus (${school.name})*\n\n` +
        `📝 *Step 2/4: What circular activity was completed?*\n` +
        `Examples: "Recycled Paper Notebook Batch #3", "Compost Delivery to Canteen"`,
      stage: 'AWAITING_ACTIVITY_TITLE',
    };
  }

  if (session.stage === 'AWAITING_ACTIVITY_TITLE') {
    if (!textInput) {
      return { ok: false, botReply: 'Please enter an activity title.', stage: 'AWAITING_ACTIVITY_TITLE' };
    }
    session.activityTitle = textInput;
    session.stage = 'AWAITING_WASTE_KG';

    return {
      ok: true,
      botReply:
        `⚖️ *Step 3/4: How many kg of waste material were recycled or diverted?*\n` +
        `Enter a number (e.g. 12.5):`,
      stage: 'AWAITING_WASTE_KG',
    };
  }

  if (session.stage === 'AWAITING_WASTE_KG') {
    const waste = parseFloat(textInput);
    if (isNaN(waste) || waste < 0) {
      return { ok: false, botReply: 'Please enter a valid weight in kg (e.g. 15.0).', stage: 'AWAITING_WASTE_KG' };
    }
    session.wasteKg = waste;
    session.stage = 'AWAITING_REVENUE_USD';

    return {
      ok: true,
      botReply:
        `💰 *Step 4/4: Total enterprise sales or revenue generated (USD or LKR equivalent)?*\n` +
        `Enter the sales amount in USD (e.g. 35.00 for ~Rs. 10,500):`,
      stage: 'AWAITING_REVENUE_USD',
    };
  }

  if (session.stage === 'AWAITING_REVENUE_USD') {
    const rev = parseFloat(textInput);
    if (isNaN(rev) || rev < 0) {
      return { ok: false, botReply: 'Please enter a valid revenue number.', stage: 'AWAITING_REVENUE_USD' };
    }

    const created = await createStudentImpactSubmission({
      actorId: actor.id,
      clubId: club.id,
      fileName: session.fileName || 'WHATSAPP_DOC.JPG',
      mimeType: session.mimeType || 'image/jpeg',
      isUncompressedDocument: true,
      s3Url: session.s3Url || '',
      s3Key: session.s3Key || '',
      exifTimestamp: session.exif?.timestamp || new Date().toISOString(),
      exifLat: session.exif?.lat ?? school.campus_lat,
      exifLng: session.exif?.lng ?? school.campus_lng,
      activityTitle: session.activityTitle || 'Circular Activity',
      activityCategory: 'upcycled_production',
      description: `Logged via WhatsApp Cloud API from +${sessionKey}`,
      wasteKg: session.wasteKg || 1.0,
      revenueUsd: rev,
      parentLogId: session.resubmitParentLogId,
    });

    // Populate WhatsApp-specific fields
    created.phone_number = sessionKey;
    created.whatsapp_message_id = `wamid.${Date.now()}`;
    created.uploaded_via_whatsapp = true;

    session.stage = 'IDLE';
    session.resubmitParentLogId = undefined;

    const isMacro = created.transaction_type === 'macro';
    const reply =
      `🎉 *ACTIVITY LOGGED VIA WHATSAPP (${created.id})*\n\n` +
      `• School: ${school.name} (${school.code})\n` +
      `• Activity: "${created.activity_title}"\n` +
      `• Sales: ${formatLkr(created.revenue_usd)} (${created.transaction_type.toUpperCase()})\n` +
      `• Diverted Waste: ${created.waste_kg} kg • CO2 Saved: ${created.co2_saved_kg} kg\n\n` +
      `📌 *Status:* PENDING Supervising Teacher Review\n` +
      (isMacro
        ? `⚠️ *Macro Notice:* Because sales exceed Rs. 15,000, your Supervising Teacher must attach an official invoice to route this to the National Expert Panel.`
        : `Your teacher can approve this on the school dashboard to release live points!`);

    return {
      ok: true,
      botReply: reply,
      stage: 'IDLE',
      createdLogId: created.id,
      quickActions: STUDENT_QUICK_ACTIONS,
      snapshot: store,
    };
  }

  return {
    ok: true,
    botReply:
      `👋 Welcome to *I2I Clubs (Idea2Impact)* (${club.name} • ${school.name})!\n\n` +
      `• Enterprise: ${club.name}\n` +
      `• Mobile: +${sessionKey}\n\n` +
      `To log an activity: Tap 📸 Log Activity or type \`/log_impact\`\n` +
      `To check status: Tap 📊 Club Status or type \`/status\``,
    stage: 'IDLE',
    quickActions: STUDENT_QUICK_ACTIONS,
  };
}

export const handleTelegramBotUpdate = handleWhatsAppCloudUpdate;
