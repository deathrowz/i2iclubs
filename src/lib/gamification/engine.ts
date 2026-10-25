import {
  ActivityCategory,
  Club,
  CriteriaScores,
  GamificationConfig,
  HealthRiskAlert,
  ImpactLog,
  LeaderboardSchoolScore,
  School,
  TransactionTier,
} from '@/types/domain';

export const LKR_PER_UNIT = 300;

/**
 * How many leaderboard points a perfect (100) weighted criteria score is worth.
 *
 * The six-criteria baseline is a quality signal, not an achievement: every club
 * starts with one. At 4.5 a strong baseline alone produced ~450 points, which
 * put eight of the fifteen schools past the 500-point ladder before a single
 * activity was verified — everyone read as "maxed out". At 2.0 a strong
 * baseline is worth ~180 and the rest of the ladder has to be earned through
 * verified micro and macro transactions.
 */
export const CRITERIA_POINT_WEIGHT = 2;

/**
 * Formats an internal financial amount into Sri Lankan Rupees (Rs.)
 */
export function formatLkr(amountUsd: number): string {
  const lkr = Math.round(amountUsd * LKR_PER_UNIT);
  return `Rs. ${lkr.toLocaleString('en-LK')}`;
}

/**
 * Classifies a transaction as Micro or Macro based on strict threshold rules:
 * - Macro: Revenue > Rs. 15,000 ($50 internal unit) OR final funding pitch
 * - Micro: Low-stakes activity (<= Rs. 15,000 revenue and not a final pitch)
 */
export function classifyTransactionTier(params: {
  revenueUsd: number;
  isFinalPitch?: boolean;
  activityCategory?: ActivityCategory | string;
  config?: Pick<GamificationConfig, 'macro_revenue_threshold_usd'>;
}): TransactionTier {
  const threshold = params.config?.macro_revenue_threshold_usd ?? 50.0;
  if (
    params.revenueUsd > threshold ||
    params.isFinalPitch === true ||
    params.activityCategory === 'final_funding_pitch'
  ) {
    return 'macro';
  }
  return 'micro';
}

/**
 * Calculates points for a Teacher-approved Micro-Transaction
 */
export function calculateMicroTransactionPoints(params: {
  wasteKg: number;
  revenueUsd: number;
  onCampusVerified: boolean;
}): number {
  const basePoints = 15;
  const envBonus = Math.min(params.wasteKg * 1.8, 35);
  const revBonus = Math.min(params.revenueUsd * 0.4, 20);
  const campusMultiplier = params.onCampusVerified ? 1.0 : 0.85;
  return Number(((basePoints + envBonus + revBonus) * campusMultiplier).toFixed(2));
}

/**
 * Calculates points for an Expert-adjudicated Macro-Transaction
 * using the 6 core criteria scores + normalized environmental/financial output.
 */
export function calculateMacroTransactionPoints(params: {
  criteriaScores: CriteriaScores;
  wasteKg: number;
  revenueUsd: number;
  config: GamificationConfig;
}): number {
  const weightedCriteria = computeWeightedCriteriaScore(params.criteriaScores, params.config);
  const envImpactScore = Math.min(params.wasteKg * 1.5, 60);
  const finImpactScore = Math.min(params.revenueUsd * 0.25, 50);

  // Normalize financial gain against environmental waste diverted
  const normMultiplier = computeFinancialEnvironmentalNormalizationIndex(
    params.revenueUsd,
    params.wasteKg,
    params.config.env_to_fin_normalization_ratio
  );

  const rawPoints = (weightedCriteria * 0.85 + envImpactScore + finImpactScore) * normMultiplier;
  return Number(rawPoints.toFixed(2));
}

/**
 * Computes weighted 0-100 score across the 6 core criteria:
 * Relevance, Business, Feasibility, Student Ownership, Sustainability, Institutional Commitment
 */
export function computeWeightedCriteriaScore(
  scores: CriteriaScores,
  config: GamificationConfig
): number {
  const totalWeight =
    config.relevance_weight +
    config.business_weight +
    config.feasibility_weight +
    config.student_ownership_weight +
    config.sustainability_weight +
    config.institutional_commitment_weight;

  const divisor = totalWeight > 0 ? totalWeight : 1;

  const weightedSum =
    scores.relevance * config.relevance_weight +
    scores.business * config.business_weight +
    scores.feasibility * config.feasibility_weight +
    scores.student_ownership * config.student_ownership_weight +
    scores.sustainability * config.sustainability_weight +
    scores.institutional_commitment * config.institutional_commitment_weight;

  return Number((weightedSum / divisor).toFixed(2));
}

/**
 * Normalizes financial metrics against environmental metrics (kg waste diverted).
 * Prevents high-revenue / zero-environmental-impact clubs from gaming the circular economy leaderboard.
 * Returns a multiplier between 0.60 and 1.35.
 */
export function computeFinancialEnvironmentalNormalizationIndex(
  totalRevenueUsd: number,
  totalWasteKg: number,
  equilibriumRatioUsdPerKg = 12.5
): number {
  if (totalRevenueUsd === 0 && totalWasteKg === 0) {
    return 1.0;
  }

  // If high revenue (> Rs. 18,000) with zero or negligible environmental impact (< 1 kg), penalize heavily
  if (totalRevenueUsd > 60 && totalWasteKg < 1) {
    return 0.62;
  }

  const normalizedFin = Math.min(100, totalRevenueUsd / 12);
  const normalizedEnv = Math.min(100, (totalWasteKg * equilibriumRatioUsdPerKg) / 12);

  // Harmonic balance between financial sustainability and material circularity
  const f = normalizedFin + 5;
  const e = normalizedEnv + 5;
  const harmonicBalance = (2 * f * e) / (f * f + e * e); // 0 to 1, peaks at 1.0 when balanced

  // Bonus when environmental impact meets or exceeds financial ratio
  const envBonus = normalizedEnv >= normalizedFin * 0.8 ? 0.15 : 0;

  const index = 0.65 + 0.55 * harmonicBalance + envBonus;
  return Number(Math.min(1.35, Math.max(0.6, index)).toFixed(2));
}

/**
 * Deterministic or randomized 10% sampler for Micro-Transactions approved by Teachers.
 */
export function shouldSelectForRandomExpertAudit(
  sampleRate = 0.1,
  deterministicSeed?: number
): boolean {
  const roll = typeof deterministicSeed === 'number' ? deterministicSeed : Math.random();
  return roll < sampleRate;
}

/**
 * Computes the complete 15-School Gamified Leaderboard with composite scores,
 * financial-vs-environmental normalization, fraud penalty deductions, and top-off seed funding tiers.
 */
export function computeSchoolLeaderboard(params: {
  schools: School[];
  clubs: Club[];
  impactLogs: ImpactLog[];
  config: GamificationConfig;
}): LeaderboardSchoolScore[] {
  const { schools, clubs, impactLogs, config } = params;

  const entries: LeaderboardSchoolScore[] = schools.map((school) => {
    const club =
      clubs.find((c) => c.id === school.id) ||
      clubs.find((c) => c.school_id === school.id) ||
      ({
        id: `club-${school.id}`,
        school_id: school.id,
        school_name: school.name,
        school_code: school.code,
        slug: school.code.toLowerCase(),
        name: `${school.name} Eco Club`,
        tagline: 'Student Circular Enterprise',
        circular_sector: 'Circular Upcycling',
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
          business: 75,
          feasibility: 75,
          student_ownership: 75,
          sustainability: 75,
          institutional_commitment: school.institutional_commitment_score,
        },
        active_members_count: 8,
        last_submission_at: new Date().toISOString(),
      } satisfies Club);

    const schoolLogs = impactLogs.filter((log) => log.school_id === school.id);
    const approvedLogs = schoolLogs.filter((log) => log.status === 'approved');
    const pendingLogs = schoolLogs.filter(
      (log) => log.status === 'pending' || log.status === 'pending_expert_review'
    );
    const fraudLogs = schoolLogs.filter(
      (log) => log.audit_flagged_fraud || log.status === 'fraud_revoked'
    );

    // Aggregate verified financial and environmental metrics
    const verified_revenue_usd = Number(
      approvedLogs.reduce((sum, l) => sum + l.revenue_usd, 0).toFixed(2)
    );
    const verified_waste_kg = Number(
      approvedLogs.reduce((sum, l) => sum + l.waste_kg, 0).toFixed(2)
    );
    const verified_co2_kg = Number(
      approvedLogs.reduce((sum, l) => sum + l.co2_saved_kg, 0).toFixed(2)
    );

    // Aggregate micro and macro points
    const micro_points_total = Number(
      approvedLogs
        .filter((l) => l.transaction_type === 'micro')
        .reduce((sum, l) => sum + l.points_awarded, 0)
        .toFixed(2)
    );
    const macro_points_total = Number(
      approvedLogs
        .filter((l) => l.transaction_type === 'macro')
        .reduce((sum, l) => sum + l.points_awarded, 0)
        .toFixed(2)
    );

    // Aggregate 6 criteria scores from baseline + approved macro logs scored by Expert Panel
    const scoredMacroLogs = approvedLogs.filter((l) => l.criteria_scores);
    const avgCriteria: CriteriaScores = { ...club.criteria_baseline };
    avgCriteria.institutional_commitment = school.institutional_commitment_score;

    if (scoredMacroLogs.length > 0) {
      const keys: (keyof CriteriaScores)[] = [
        'relevance',
        'business',
        'feasibility',
        'student_ownership',
        'sustainability',
        'institutional_commitment',
      ];
      keys.forEach((k) => {
        const macroAvg =
          scoredMacroLogs.reduce((acc, l) => acc + (l.criteria_scores?.[k] ?? avgCriteria[k]), 0) /
          scoredMacroLogs.length;
        avgCriteria[k] = Number((avgCriteria[k] * 0.4 + macroAvg * 0.6).toFixed(1));
      });
    }

    const weighted_criteria_score = computeWeightedCriteriaScore(avgCriteria, config);
    const fin_env_normalization_index = computeFinancialEnvironmentalNormalizationIndex(
      verified_revenue_usd,
      verified_waste_kg,
      config.env_to_fin_normalization_ratio
    );

    // Total fraud penalties deducted for this school
    const logPenalties = fraudLogs.reduce((sum, l) => sum + l.penalty_points, 0);
    const penalty_points_deducted = Math.max(school.penalty_points_deducted, logPenalties);

    // Composite Score = (Weighted 6-Criteria * weight) + ((Micro + Macro Points) * Fin/Env Normalization Index) - Fraud Penalties
    const rawComposite =
      weighted_criteria_score * CRITERIA_POINT_WEIGHT +
      (micro_points_total + macro_points_total) * fin_env_normalization_index -
      penalty_points_deducted;

    const composite_leaderboard_score = Number(Math.max(0, rawComposite).toFixed(1));

    return {
      rank: 0,
      school,
      club,
      criteria_scores: avgCriteria,
      weighted_criteria_score,
      verified_revenue_usd,
      verified_waste_kg,
      verified_co2_kg,
      fin_env_normalization_index,
      micro_points_total,
      macro_points_total,
      penalty_points_deducted,
      composite_leaderboard_score,
      approved_transactions_count: approvedLogs.length,
      pending_transactions_count: pendingLogs.length,
      audit_fraud_count: fraudLogs.length,
      topoff_funding_tier: 'Base Grant Only',
      topoff_funding_amount_usd: 0,
    };
  });

  // Sort descending by composite_leaderboard_score
  entries.sort((a, b) => b.composite_leaderboard_score - a.composite_leaderboard_score);

  // Assign rank and gamified top-off seed funding award tiers in Sri Lankan Rupees (Rs.)
  return entries.map((entry, idx) => {
    const rank = idx + 1;
    let topoff_funding_tier: LeaderboardSchoolScore['topoff_funding_tier'] = 'Base Grant Only';
    let topoff_funding_amount_usd = 0;

    if (rank <= 2) {
      topoff_funding_tier = 'Platinum (Rs. 1,050,000)';
      topoff_funding_amount_usd = 3500;
    } else if (rank <= 5) {
      topoff_funding_tier = 'Gold (Rs. 750,000)';
      topoff_funding_amount_usd = 2500;
    } else if (rank <= 10) {
      topoff_funding_tier = 'Silver (Rs. 450,000)';
      topoff_funding_amount_usd = 1500;
    } else if (rank <= 13) {
      topoff_funding_tier = 'Bronze (Rs. 150,000)';
      topoff_funding_amount_usd = 500;
    }

    return {
      ...entry,
      rank,
      topoff_funding_tier,
      topoff_funding_amount_usd,
    };
  });
}

/**
 * Generates Health & Risk Dashboard alerts for inactive clubs and anomalous transactions
 * (e.g., high revenue with zero environmental impact, off-campus EXIF GPS coordinates, fraud flags).
 */
export function detectHealthAndRiskAnomalies(params: {
  schools: School[];
  clubs: Club[];
  impactLogs: ImpactLog[];
  referenceDate?: Date;
}): HealthRiskAlert[] {
  const { schools, clubs, impactLogs } = params;
  const now = params.referenceDate ?? new Date('2026-10-12T12:00:00Z');
  const alerts: HealthRiskAlert[] = [];

  // 1. Check for Inactive Clubs (> 14 days since last submission)
  for (const club of clubs) {
    const lastSub = new Date(club.last_submission_at);
    const daysInactive = Math.floor((now.getTime() - lastSub.getTime()) / (1000 * 60 * 60 * 24));
    if (daysInactive >= 14) {
      alerts.push({
        id: `risk-inactive-${club.id}`,
        severity: daysInactive >= 21 ? 'critical' : 'high',
        category: 'INACTIVE_CLUB',
        school_id: club.school_id,
        school_name: club.school_name,
        school_code: club.school_code,
        club_id: club.id,
        club_name: club.name,
        title: `Inactive School Club: ${daysInactive} Days Without Activity`,
        description: `${club.name} (${club.school_name}) has not submitted an activity via WhatsApp in ${daysInactive} days.`,
        metric_highlight: `${daysInactive} days inactive`,
        recommended_action:
          'Message Student President on WhatsApp and check in with Supervising Teacher.',
        detected_at: now.toISOString(),
      });
    }
  }

  // 2. Check Impact Logs for Anomalies
  for (const log of impactLogs) {
    // High revenue with zero or near-zero environmental impact ("Greenwashing / Non-Circular Revenue")
    if (log.revenue_usd >= 75 && log.waste_kg <= 0.5) {
      alerts.push({
        id: `risk-greenwash-${log.id}`,
        severity: 'critical',
        category: 'HIGH_REVENUE_ZERO_IMPACT',
        school_id: log.school_id,
        school_name: log.school_name,
        school_code: log.school_code,
        club_id: log.club_id,
        club_name: log.club_name,
        related_log_id: log.id,
        title: `High Sales (${formatLkr(log.revenue_usd)}) with 0 kg Recycled Material`,
        description: `"${log.activity_title}" reported ${formatLkr(
          log.revenue_usd
        )} in sales but ${log.waste_kg} kg of recycled material. Possible non-circular resale.`,
        metric_highlight: `${formatLkr(log.revenue_usd)} / ${log.waste_kg} kg`,
        recommended_action:
          'Hold Macro grant points and request raw material receipt via WhatsApp.',
        detected_at: log.created_at,
      });
    }

    // EXIF GPS Geofence Drift (Photo taken significantly outside school campus boundary)
    const school = schools.find((s) => s.id === log.school_id);
    const radius = school?.campus_radius_meters ?? 500;
    if (!log.on_campus_verified || log.campus_distance_meters > radius) {
      alerts.push({
        id: `risk-geofence-${log.id}`,
        severity: log.campus_distance_meters > 2000 ? 'high' : 'medium',
        category: 'EXIF_GEOFENCE_ANOMALY',
        school_id: log.school_id,
        school_name: log.school_name,
        school_code: log.school_code,
        club_id: log.club_id,
        club_name: log.club_name,
        related_log_id: log.id,
        title: `Photo Taken Off-Campus (${log.campus_distance_meters}m from school)`,
        description: `Photo GPS (${log.exif_lat.toFixed(4)}, ${log.exif_lng.toFixed(
          4
        )}) is ${log.campus_distance_meters}m away from ${log.school_name}.`,
        metric_highlight: `${log.campus_distance_meters}m from school`,
        recommended_action:
          'Teacher should confirm if this was an approved off-site community sale.',
        detected_at: log.created_at,
      });
    }

    // Fraud Confirmed during Random 10% Micro Audit
    if (log.audit_flagged_fraud || log.status === 'fraud_revoked') {
      alerts.push({
        id: `risk-fraud-${log.id}`,
        severity: 'critical',
        category: 'AUDIT_FRAUD_DETECTED',
        school_id: log.school_id,
        school_name: log.school_name,
        school_code: log.school_code,
        club_id: log.club_id,
        club_name: log.club_name,
        related_log_id: log.id,
        title: `Audit Penalty Applied (-${log.penalty_points} pts)`,
        description: `National Panel flagged "${log.activity_title}" during random audit. Points revoked and -${log.penalty_points} penalty points deducted from ${log.school_name}.`,
        metric_highlight: `-${log.penalty_points} pts penalty`,
        recommended_action:
          'Require Supervising Teacher co-signature on next school submissions.',
        detected_at: log.updated_at,
      });
    }
  }

  // Sort alerts by severity (critical -> high -> medium)
  const severityOrder = { critical: 0, high: 1, medium: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}
