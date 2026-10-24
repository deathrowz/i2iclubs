/**
 * Single source of truth for the student-facing gamification tier ladder.
 *
 * Progression is score-based: a school's composite leaderboard score grows as
 * verified activities are approved. The tier NAMES and grant amounts are
 * aligned with the rank-based funding tiers shown on the national leaderboard
 * (Platinum / Gold / Silver / Bronze) so students never see two vocabularies.
 *
 * Consumed by the student hero, the XP meter, and the student dashboard so
 * every surface reports the same level, title, and threshold.
 */

export type GamificationTierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface GamificationTier {
  level: number; // 1–4
  tier: GamificationTierName;
  title: string; // friendly display name
  threshold: number; // composite score needed to reach this level
  grantLkr: string; // top-off seed grant label
}

export const GAMIFICATION_TIERS: GamificationTier[] = [
  { level: 1, tier: 'Bronze', title: 'Rising Green Club', threshold: 0, grantLkr: 'Rs. 150,000' },
  { level: 2, tier: 'Silver', title: 'Silver Upcycler', threshold: 260, grantLkr: 'Rs. 450,000' },
  { level: 3, tier: 'Gold', title: 'Gold Eco-Warrior', threshold: 340, grantLkr: 'Rs. 750,000' },
  { level: 4, tier: 'Platinum', title: 'Platinum Eco-Enterprise', threshold: 420, grantLkr: 'Rs. 1,050,000' },
];

/** Full scale of the XP meter (top of Platinum). */
export const MAX_TIER_SCORE = 500;

export interface TierPosition {
  current: GamificationTier;
  next: GamificationTier | null;
}

/** Resolves the tier a score currently occupies and the next tier to reach. */
export function getGamificationTier(score: number): TierPosition {
  let idx = 0;
  for (let i = 0; i < GAMIFICATION_TIERS.length; i += 1) {
    if (score >= GAMIFICATION_TIERS[i].threshold) idx = i;
  }
  return {
    current: GAMIFICATION_TIERS[idx],
    next: GAMIFICATION_TIERS[idx + 1] ?? null,
  };
}

export interface TierProgress {
  /** 0–100 progress through the current level toward the next. */
  pct: number;
  /** Points still needed to reach the next level (0 once at the top). */
  pointsRemaining: number;
}

/** Progress within the current level, toward the next threshold. */
export function getTierProgress(score: number): TierProgress {
  const { current, next } = getGamificationTier(score);
  if (!next) return { pct: 100, pointsRemaining: 0 };
  const span = next.threshold - current.threshold;
  const pct =
    span <= 0
      ? 100
      : Math.min(100, Math.max(0, Math.round(((score - current.threshold) / span) * 100)));
  return { pct, pointsRemaining: Number((next.threshold - score).toFixed(1)) };
}
