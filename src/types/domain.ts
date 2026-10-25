export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'expert_admin'
  | 'expert'
  | 'teacher'
  | 'student'
  | 'mentor';

export type TransactionTier = 'micro' | 'macro';

export type ImpactLogStatus =
  | 'pending'
  | 'approved'
  | 'pending_expert_review'
  | 'rejected'
  | 'flagged'
  | 'fraud_revoked';

export type AuditReviewStatus =
  | 'not_selected'
  | 'pending_audit'
  | 'audit_passed'
  | 'fraud_confirmed';

export type ActivityCategory =
  | 'weekly_meeting'
  | 'waste_collection'
  | 'upcycled_production'
  | 'product_sales'
  | 'community_workshop'
  | 'final_funding_pitch';

export interface CriteriaScores {
  relevance: number; // 0 - 100
  business: number; // 0 - 100
  feasibility: number; // 0 - 100
  student_ownership: number; // 0 - 100
  sustainability: number; // 0 - 100
  institutional_commitment: number; // 0 - 100
}

export interface GamificationConfig {
  relevance_weight: number;
  business_weight: number;
  feasibility_weight: number;
  student_ownership_weight: number;
  sustainability_weight: number;
  institutional_commitment_weight: number;
  macro_revenue_threshold_usd: number;
  micro_audit_sample_rate: number;
  fraud_penalty_points: number;
  env_to_fin_normalization_ratio: number;
  updated_at: string;
}

export interface School {
  id: string;
  code: string;
  name: string;
  district: string;
  city: string;
  campus_lat: number;
  campus_lng: number;
  campus_radius_meters: number;
  institutional_commitment_score: number;
  penalty_points_deducted: number;
  seed_funding_base_usd: number;
  seed_funding_topoff_usd: number;
}

export interface OrgChartNode {
  id: string;
  role_title: string;
  holder_name: string;
  tier: 'executive' | 'operations' | 'advisor';
  department: string;
  responsibilities: string;
}

export interface ClubMilestone {
  id: string;
  title: string;
  description: string;
  completed_at: string;
  verified_by: string;
  seed_tranche_unlocked_usd: number;
  impact_summary: string;
}

export interface BusinessModelCanvas {
  value_proposition: string;
  circular_feedstock: string;
  revenue_streams: string[];
  cost_structure: string[];
  customer_segments: string[];
  environmental_kpi: string;
}

export interface Club {
  id: string;
  school_id: string;
  school_name: string;
  school_code: string;
  slug: string;
  name: string;
  tagline: string;
  circular_sector: string;
  business_model_canvas: BusinessModelCanvas;
  org_chart: OrgChartNode[];
  approved_milestones: ClubMilestone[];
  criteria_baseline: CriteriaScores;
  /** Public URL of the school crest uploaded by the platform admin. */
  logo_url?: string;
  active_members_count: number;
  last_submission_at: string;
}

export interface UserProfile {
  id: string;
  auth_user_id?: string;
  email: string;
  login_code?: string;
  phone_number?: string; // E.164 MSISDN format (e.g., 94771234501)
  organization?: string;
  full_name: string;
  role: UserRole;
  school_id: string | null;
  school_name?: string;
  school_code?: string;
  club_id: string | null;
  club_name?: string;
  assigned_club_ids?: string[]; // Used for Mentor role read-only scoping
  telegram_user_id?: number;
  telegram_username?: string;
}

export interface ExifMetadata {
  timestamp: string;
  lat: number;
  lng: number;
  deviceMake?: string;
  deviceModel?: string;
  isUncompressedDocument: boolean;
  fileSizeBytes?: number;
  mimeType: string;
}

export type DocumentCategory =
  | 'sales_invoice'
  | 'official_receipt'
  | 'waste_scale_ticket'
  | 'delivery_challan'
  | 'canteen_sales_summary';

export interface VerifiedDocument {
  id: string;
  log_id: string;
  doc_category: DocumentCategory;
  file_name: string;
  mime_type: string;
  s3_url: string;
  s3_key: string;
  uploaded_by_role: UserRole;
  uploaded_by_id: string;
  uploaded_by_name: string;
  verified_by_teacher_id?: string;
  verified_by_teacher_name?: string;
  verified_amount_lkr?: number;
  uploaded_via_whatsapp?: boolean;
  uploaded_via_telegram?: boolean;
  notes?: string;
  created_at: string;
}

export interface ImpactLog {
  id: string;
  club_id: string;
  club_name: string;
  school_id: string;
  school_name: string;
  school_code: string;
  student_id: string;
  student_name: string;
  phone_number?: string;
  whatsapp_message_id?: string;
  telegram_username?: string;
  telegram_message_id?: string;
  file_name: string;
  mime_type: string;
  is_uncompressed_document: boolean;
  s3_url: string;
  s3_key: string;
  media_storage_path?: string;
  file_size_bytes?: number;

  // EXIF Metadata
  exif_timestamp: string;
  exif_lat: number;
  exif_lng: number;
  exif_device_make?: string;
  exif_device_model?: string;
  campus_distance_meters: number;
  on_campus_verified: boolean;

  // Impact & Financial Data
  activity_title: string;
  activity_category: ActivityCategory;
  description: string;
  waste_kg: number;
  revenue_usd: number;
  co2_saved_kg: number;
  is_final_pitch: boolean;

  // Invoices, Sales Receipts & Documentation Pipeline
  verified_documents?: VerifiedDocument[];
  uploaded_via_whatsapp?: boolean;
  uploaded_via_telegram?: boolean;
  scored_via_whatsapp?: boolean;
  scored_via_telegram?: boolean;
  whatsapp_dossier_sent_to_experts?: boolean;
  telegram_dossier_sent_to_experts?: boolean;

  // Routing & Validation State
  transaction_type: TransactionTier;
  status: ImpactLogStatus;

  // Tier 1 Teacher Endorsement
  teacher_reviewer_id?: string;
  teacher_reviewer_name?: string;
  teacher_reviewed_at?: string;
  teacher_notes?: string;

  // Tier 2 Safeguard: Random 10% Micro Audit & Macro Expert Adjudication
  random_audit_selected: boolean;
  audit_status: AuditReviewStatus;
  audit_flagged_fraud: boolean;
  expert_reviewer_id?: string;
  expert_reviewer_name?: string;
  expert_reviewed_at?: string;
  expert_notes?: string;
  criteria_scores?: CriteriaScores;

  // Points & Penalties
  points_awarded: number;
  penalty_points: number;

  // Resolution Loop
  rejection_reason?: string;
  resubmission_count: number;
  parent_log_id?: string;
  whatsapp_notification_sent?: boolean;
  whatsapp_last_message?: string;
  telegram_notification_sent?: boolean;
  telegram_last_message?: string;

  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  impact_log_id: string;
  club_id: string;
  club_name: string;
  school_id: string;
  school_name: string;
  school_code: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action_type:
    | 'STUDENT_SUBMISSION_CREATED'
    | 'STUDENT_RESUBMISSION'
    | 'WHATSAPP_SUBMISSION_INGESTED'
    | 'TEACHER_APPROVED_MICRO'
    | 'TEACHER_ENDORSED_MACRO_ROUTED'
    | 'TEACHER_UPLOADED_VERIFIED_DOCUMENT'
    | 'EXPERT_APPROVED_MACRO'
    | 'EXPERT_SCORED_VIA_WHATSAPP'
    | 'EXPERT_SCORED_VIA_TELEGRAM'
    | 'SUBMISSION_REJECTED_RESOLUTION_LOOP'
    | 'SUBMISSION_FLAGGED_FOR_INVESTIGATION'
    | 'EXPERT_AUDIT_PASSED'
    | 'EXPERT_AUDIT_FRAUD_PENALTY';
  previous_status: ImpactLogStatus | null;
  new_status: ImpactLogStatus;
  points_delta: number;
  reason_or_notes: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LeaderboardSchoolScore {
  rank: number;
  school: School;
  club: Club;
  criteria_scores: CriteriaScores;
  weighted_criteria_score: number; // 0 - 100
  verified_revenue_usd: number;
  verified_waste_kg: number;
  verified_co2_kg: number;
  fin_env_normalization_index: number; // 0.50 - 1.35 multiplier
  micro_points_total: number;
  macro_points_total: number;
  penalty_points_deducted: number;
  composite_leaderboard_score: number;
  approved_transactions_count: number;
  pending_transactions_count: number;
  audit_fraud_count: number;
  topoff_funding_tier:
    | 'Platinum (Rs. 1,050,000)'
    | 'Gold (Rs. 750,000)'
    | 'Silver (Rs. 450,000)'
    | 'Bronze (Rs. 150,000)'
    | 'Base Grant Only';
  topoff_funding_amount_usd: number;
}

export interface HealthRiskAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  category:
    | 'INACTIVE_CLUB'
    | 'HIGH_REVENUE_ZERO_IMPACT'
    | 'EXIF_GEOFENCE_ANOMALY'
    | 'AUDIT_FRAUD_DETECTED'
    | 'STALE_EXIF_TIMESTAMP';
  school_id: string;
  school_name: string;
  school_code: string;
  club_id: string;
  club_name: string;
  related_log_id?: string;
  title: string;
  description: string;
  metric_highlight: string;
  recommended_action: string;
  detected_at: string;
}

export interface WhatsAppBotOutboundMessage {
  id: string;
  chat_id: number | string;
  student_name: string;
  whatsapp_number?: string;
  telegram_username?: string;
  log_id?: string;
  type: 'REJECTION_RESOLUTION' | 'SUBMISSION_RECEIPT' | 'METADATA_REJECTION' | 'APPROVAL_NOTICE' | 'FRAUD_PENALTY_NOTICE';
  text: string;
  sent_at: string;
}

export type TelegramBotOutboundMessage = WhatsAppBotOutboundMessage;
