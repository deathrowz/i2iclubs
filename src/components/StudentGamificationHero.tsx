'use client';

import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  Leaf,
  Lock,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Club,
  LeaderboardSchoolScore,
  School,
  UserProfile,
} from '@/types/domain';
import { formatLkr } from '@/lib/gamification/engine';
import { getGamificationTier, getTierProgress } from '@/lib/gamification/tiers';
import {
  BadgeGpsGuardian,
  BadgeZeroWaste,
  BadgePolaPioneer,
  BadgePitchStar,
  BadgeAuditShield,
  BadgeCommittee,
  BadgeLevelMedal,
  BadgeWasteToValue,
  BadgeSchoolEnterprise,
  BadgeActionReady,
  BadgeStudentLeader,
  BadgeCleanCommunity,
  BadgeGreenCharter,
  BadgeFirstFootprint,
  BadgeGreenSeedling,
  BadgeCenturyGrove,
  BadgePilotVanguard,
} from '@/components/BadgeIllustrations';
import { GameAnimatedXpMeter } from '@/components/GameAnimatedXpMeter';
import { SchoolLogo } from '@/components/SchoolLogo';

/**
 * Compact badge chip: encodes tier + XP in one legible line ("T2 · 128 XP")
 * so the tile needs a single readable element instead of two 10-11px lines.
 */
function badgeChipLabel(badge: {
  tierName?: string;
  xp?: string;
  metric?: string;
  unlocked?: boolean;
}): string {
  const xp = String(badge.xp ?? '').trim();
  const xpHasNumber = /\d/.test(xp);

  if (badge.unlocked) return 'Earned';
  return xpHasNumber ? xp.replace(/^\+/, '') : 'Locked';
}

export interface StudentGamificationHeroProps {
  school: School;
  club: Club;
  schoolEntry: LeaderboardSchoolScore;
  activeUser: UserProfile;
  leaderboard: LeaderboardSchoolScore[];
  approvedLogsCount?: number;
  onLogActivityClick?: () => void;
}

export function StudentGamificationHero({
  school,
  club,
  schoolEntry,
  activeUser,
  leaderboard,
  approvedLogsCount = 0,
  onLogActivityClick,
}: StudentGamificationHeroProps) {
  const currentScore = schoolEntry.composite_leaderboard_score;
  const [selectedBadgeModal, setSelectedBadgeModal] = useState<any | null>(null);

  // Single source of truth for the score-based tier ladder.
  const { current: currentTier, next: nextTier } = getGamificationTier(currentScore);
  const { pointsRemaining } = getTierProgress(currentScore);

  const tierConfig = {
    level: currentTier.level,
    tierName: currentTier.title,
    nextTierName: nextTier ? nextTier.title : 'Platinum Max Tier (Rs. 1,050,000 Grant Unlocked)',
    pointsRemaining,
  };

  // Rivalry context
  const aboveEntry =
    schoolEntry.rank > 1
      ? leaderboard.find((e) => e.rank === schoolEntry.rank - 1)
      : null;
  const belowEntry =
    schoolEntry.rank < leaderboard.length
      ? leaderboard.find((e) => e.rank === schoolEntry.rank + 1)
      : null;

  // Dynamic action-oriented coaching prompt
  const actionPrompt = (() => {
    if (tierConfig.pointsRemaining > 0 && tierConfig.pointsRemaining <= 35) {
      return {
        icon: Flame,
        headline: 'Almost there!',
        text: `Log one more compost batch or plastic collection to reach ${tierConfig.nextTierName} (${tierConfig.pointsRemaining} pts needed)!`,
        badge: 'Priority Action',
        buttonText: 'Log Compost Batch Now →',
      };
    }
    if (schoolEntry.verified_waste_kg < 100) {
      const neededKg = Number((100 - schoolEntry.verified_waste_kg).toFixed(1));
      return {
        icon: Leaf,
        headline: 'Zero-Waste Milestone in Reach',
        text: `Collect ${neededKg} more kg of school PET plastic or organic compost to unlock the 100 kg Zero-Waste Milestone Badge!`,
        badge: 'Milestone Quest',
        buttonText: 'Submit Waste Weighbridge Scale →',
      };
    }
    if (aboveEntry) {
      const gap = (aboveEntry.composite_leaderboard_score - currentScore).toFixed(1);
      return {
        icon: Target,
        headline: `Chasing #${aboveEntry.rank} ${aboveEntry.school.name}`,
        text: `You're just ${gap} pts behind ${aboveEntry.school.name}! One verified sale activity can overtake them on the national leaderboard.`,
        badge: 'Friendly Rivalry',
        buttonText: 'Log Enterprise Activity →',
      };
    }
    if (schoolEntry.rank === 1 && belowEntry) {
      const lead = (currentScore - belowEntry.composite_leaderboard_score).toFixed(1);
      return {
        icon: Crown,
        headline: 'Defend National #1 Rank!',
        text: `Leading Sri Lanka with ${currentScore} pts! You have a +${lead} pt cushion ahead of #${belowEntry.rank} ${belowEntry.school.name}.`,
        badge: 'Defending Champion',
        buttonText: 'Log Daily Activity →',
      };
    }
    return {
      icon: Sparkles,
      headline: 'Keep the Circular Momentum Going',
      text: 'Submit verified uncompressed photos directly at school to earn on-campus points and unlock top-off grants.',
      badge: 'Action Hub',
      buttonText: 'Upload New Photo →',
    };
  })();

  // Track Tier Progression Helper (Tier 1: 0-100 Novice, Tier 2: 101-300 Active, Tier 3: 301-700 Advanced, Tier 4: 701+ Master)
  const getTrackTier = (pts: number) => {
    if (pts >= 701) {
      return {
        tier: 4,
        tierName: 'Tier 4: Master',
        thresholdLabel: '701+ pts',
        nextTierName: 'Max Master Tier',
        pointsToNextTier: 0,
        progressPct: 100,
      };
    }
    if (pts >= 301) {
      return {
        tier: 3,
        tierName: 'Tier 3: Advanced',
        thresholdLabel: '301 - 700 pts',
        nextTierName: 'Tier 4: Master',
        pointsToNextTier: 701 - pts,
        progressPct: Math.min(100, Math.round(((pts - 301) / (701 - 301)) * 100)),
      };
    }
    if (pts >= 101) {
      return {
        tier: 2,
        tierName: 'Tier 2: Active',
        thresholdLabel: '101 - 300 pts',
        nextTierName: 'Tier 3: Advanced',
        pointsToNextTier: 301 - pts,
        progressPct: Math.min(100, Math.round(((pts - 101) / (301 - 101)) * 100)),
      };
    }
    return {
      tier: 1,
      tierName: 'Tier 1: Novice',
      thresholdLabel: '0 - 100 pts',
      nextTierName: 'Tier 2: Active',
      pointsToNextTier: 101 - pts,
      progressPct: Math.min(100, Math.round((pts / 101) * 100)),
    };
  };

  // Compute points for each of the 6 evaluation tracks
  const wasteTrackPts = Math.round((schoolEntry.criteria_scores?.relevance ?? 60) * 2.2 + schoolEntry.verified_waste_kg);
  const wasteTier = getTrackTier(wasteTrackPts);

  const enterpriseTrackPts = Math.round((schoolEntry.criteria_scores?.business ?? 50) * 2.2 + (schoolEntry.verified_revenue_usd * 0.7));
  const enterpriseTier = getTrackTier(enterpriseTrackPts);

  const actionTrackPts = Math.round((schoolEntry.criteria_scores?.feasibility ?? 70) * 2.4);
  const actionTier = getTrackTier(actionTrackPts);

  const leaderTrackPts = Math.round((schoolEntry.criteria_scores?.student_ownership ?? 65) * 2.2 + (club.active_members_count * 3));
  const leaderTier = getTrackTier(leaderTrackPts);

  const communityTrackPts = Math.round((schoolEntry.criteria_scores?.sustainability ?? 60) * 2.4);
  const communityTier = getTrackTier(communityTrackPts);

  const charterTrackPts = Math.round((schoolEntry.criteria_scores?.institutional_commitment ?? 80) * 2.4);
  const charterTier = getTrackTier(charterTrackPts);

  // Simplified Gamification Model: 6 Core Track Badges + Milestone Badges
  const allBadgesList = [
    // --- 6 CORE TRACK BADGES (Evolving Lvl 1 -> Lvl 4) ---
    {
      id: 'track_waste_to_value',
      name: 'Waste to Value',
      fullName: 'Waste-to-Value Champion',
      type: 'track' as const,
      trackKey: 'waste_to_value',
      category: '6 Core Tracks',
      date: `${wasteTier.tierName} (${wasteTrackPts} pts)`,
      metric: `${wasteTier.tierName} • ${wasteTrackPts} pts`,
      unlocked: true,
      xp: `+${wasteTrackPts} XP`,
      currentPoints: wasteTrackPts,
      tierLevel: wasteTier.tier,
      tierName: wasteTier.tierName,
      nextTierName: wasteTier.nextTierName,
      pointsToNextTier: wasteTier.pointsToNextTier,
      progressPct: wasteTier.progressPct,
      desc: 'Sorting routines, campus composting batches, and upcycled products diverted from landfills.',
      renderIllustration: (size: number) => (
        <BadgeWasteToValue size={size} unlocked={true} />
      ),
    },
    {
      id: 'track_school_enterprise',
      name: 'Enterprise Star',
      fullName: 'School Enterprise Star',
      type: 'track' as const,
      trackKey: 'school_enterprise',
      category: '6 Core Tracks',
      date: `${enterpriseTier.tierName} (${enterpriseTrackPts} pts)`,
      metric: `${enterpriseTier.tierName} • ${enterpriseTrackPts} pts`,
      unlocked: true,
      xp: `+${enterpriseTrackPts} XP`,
      currentPoints: enterpriseTrackPts,
      tierLevel: enterpriseTier.tier,
      tierName: enterpriseTier.tierName,
      nextTierName: enterpriseTier.nextTierName,
      pointsToNextTier: enterpriseTier.pointsToNextTier,
      progressPct: enterpriseTier.progressPct,
      desc: 'Sales revenue generated through school bookshops, green fairs, and seedling nursery sales.',
      renderIllustration: (size: number) => (
        <BadgeSchoolEnterprise size={size} unlocked={true} />
      ),
    },
    {
      id: 'track_action_ready',
      name: 'Action Ready',
      fullName: 'Action Ready Club',
      type: 'track' as const,
      trackKey: 'action_ready',
      category: '6 Core Tracks',
      date: `${actionTier.tierName} (${actionTrackPts} pts)`,
      metric: `${actionTier.tierName} • ${actionTrackPts} pts`,
      unlocked: true,
      xp: `+${actionTrackPts} XP`,
      currentPoints: actionTrackPts,
      tierLevel: actionTier.tier,
      tierName: actionTier.tierName,
      nextTierName: actionTier.nextTierName,
      pointsToNextTier: actionTier.pointsToNextTier,
      progressPct: actionTier.progressPct,
      desc: 'Campus sorting bins installed, tools maintained, and 4+ consecutive weeks of active logging.',
      renderIllustration: (size: number) => (
        <BadgeActionReady size={size} unlocked={true} />
      ),
    },
    {
      id: 'track_student_leader',
      name: 'Student Leader',
      fullName: 'Student Eco-Leader',
      type: 'track' as const,
      trackKey: 'student_leader',
      category: '6 Core Tracks',
      date: `${leaderTier.tierName} (${leaderTrackPts} pts)`,
      metric: `${leaderTier.tierName} • ${leaderTrackPts} pts`,
      unlocked: true,
      xp: `+${leaderTrackPts} XP`,
      currentPoints: leaderTrackPts,
      tierLevel: leaderTier.tier,
      tierName: leaderTier.tierName,
      nextTierName: leaderTier.nextTierName,
      pointsToNextTier: leaderTier.pointsToNextTier,
      progressPct: leaderTier.progressPct,
      desc: 'Student ownership, after-school collection shifts, peer team leadership, and junior mentoring.',
      renderIllustration: (size: number) => (
        <BadgeStudentLeader size={size} unlocked={true} />
      ),
    },
    {
      id: 'track_clean_community',
      name: 'Clean Community',
      fullName: 'Clean Green Community',
      type: 'track' as const,
      trackKey: 'clean_community',
      category: '6 Core Tracks',
      date: `${communityTier.tierName} (${communityTrackPts} pts)`,
      metric: `${communityTier.tierName} • ${communityTrackPts} pts`,
      unlocked: true,
      xp: `+${communityTrackPts} XP`,
      currentPoints: communityTrackPts,
      tierLevel: communityTier.tier,
      tierName: communityTier.tierName,
      nextTierName: communityTier.nextTierName,
      pointsToNextTier: communityTier.pointsToNextTier,
      progressPct: communityTier.progressPct,
      desc: 'School tree planting, shramadana border cleanups, and diverting recyclables from community dumps.',
      renderIllustration: (size: number) => (
        <BadgeCleanCommunity size={size} unlocked={true} />
      ),
    },
    {
      id: 'track_green_charter',
      name: 'Green Charter',
      fullName: 'Green Charter School',
      type: 'track' as const,
      trackKey: 'green_charter',
      category: '6 Core Tracks',
      date: `${charterTier.tierName} (${charterTrackPts} pts)`,
      metric: `${charterTier.tierName} • ${charterTrackPts} pts`,
      unlocked: true,
      xp: `+${charterTrackPts} XP`,
      currentPoints: charterTrackPts,
      tierLevel: charterTier.tier,
      tierName: charterTier.tierName,
      nextTierName: charterTier.nextTierName,
      pointsToNextTier: charterTier.pointsToNextTier,
      progressPct: charterTier.progressPct,
      desc: 'Principal-authorized green club charter and school-wide ban on single-use lunch sheet wrappers.',
      renderIllustration: (size: number) => (
        <BadgeGreenCharter size={size} unlocked={true} />
      ),
    },

    // --- PLATFORM MILESTONE BADGES (Cumulative Benchmarks & Feats) ---
    {
      id: 'milestone_first_action',
      name: 'First Footprint',
      fullName: 'First Footprint',
      type: 'milestone' as const,
      category: 'Milestones',
      date: currentScore >= 25 ? 'Earned' : 'Locked Milestone',
      metric: '25+ pts Cumulative',
      unlocked: currentScore >= 25,
      xp: '+25 XP',
      desc: 'Earned your first 25 cumulative points across any sustainability tracks.',
      renderIllustration: (size: number) => (
        <BadgeFirstFootprint size={size} unlocked={currentScore >= 25} />
      ),
    },
    {
      id: 'milestone_500_club',
      name: 'Green Seedling',
      fullName: 'Green Seedling',
      type: 'milestone' as const,
      category: 'Milestones',
      date: currentScore >= 500 ? 'Earned' : 'Locked Milestone',
      metric: '500+ pts Cumulative',
      unlocked: currentScore >= 500,
      xp: '+50 XP',
      desc: 'Crossed 500 cumulative points across school circular activities.',
      renderIllustration: (size: number) => (
        <BadgeGreenSeedling size={size} unlocked={currentScore >= 500} />
      ),
    },
    {
      id: 'milestone_1000_club',
      name: 'Century Grove',
      fullName: 'Century Grove',
      type: 'milestone' as const,
      category: 'Milestones',
      date: currentScore >= 1000 ? 'Earned' : 'Locked Milestone',
      metric: '1,000+ pts Cumulative',
      unlocked: currentScore >= 1000,
      xp: '+150 XP',
      desc: 'Exceeded 1,000 cumulative points demonstrating sustained circular enterprise leadership.',
      renderIllustration: (size: number) => (
        <BadgeCenturyGrove size={size} unlocked={currentScore >= 1000} />
      ),
    },
    {
      id: 'milestone_2500_club',
      name: 'Pilot Vanguard',
      fullName: 'National Pilot Vanguard',
      type: 'milestone' as const,
      category: 'Milestones',
      date: currentScore >= 2500 ? 'Earned' : 'Locked Milestone',
      metric: '2,500+ pts Cumulative',
      unlocked: currentScore >= 2500,
      xp: '+500 XP',
      desc: 'National pilot vanguard exceeding 2,500 aggregate points across all six pillars.',
      renderIllustration: (size: number) => (
        <BadgePilotVanguard size={size} unlocked={currentScore >= 2500} />
      ),
    },
    {
      id: 'milestone_zero_waste_100kg',
      name: 'Zero-Waste 100 kg',
      fullName: '100 kg Zero-Waste Milestone',
      type: 'milestone' as const,
      category: 'Milestones',
      date: schoolEntry.verified_waste_kg >= 100 ? 'Earned' : 'In Progress',
      metric: `${schoolEntry.verified_waste_kg} / 100 kg`,
      unlocked: schoolEntry.verified_waste_kg >= 100,
      xp: '+100 XP',
      desc: 'Recycled over 100 kg of campus PET bottles, organic compost, or paper feedstock.',
      renderIllustration: (size: number) => (
        <BadgeZeroWaste size={size} unlocked={schoolEntry.verified_waste_kg >= 100} />
      ),
    },
    {
      id: 'milestone_clean_audit',
      name: 'Audit Shield',
      fullName: 'Clean Audit Shield',
      type: 'milestone' as const,
      category: 'Milestones',
      date: schoolEntry.penalty_points_deducted === 0 ? 'Active Shield' : 'Penalty Flag',
      metric: schoolEntry.penalty_points_deducted === 0 ? '0 Deductions' : `-${schoolEntry.penalty_points_deducted} pts`,
      unlocked: schoolEntry.penalty_points_deducted === 0,
      xp: 'Active Shield',
      desc: 'Passed the random micro transaction audit with zero fraud flags or location penalties.',
      renderIllustration: (size: number) => (
        <BadgeAuditShield size={size} unlocked={schoolEntry.penalty_points_deducted === 0} />
      ),
    },
  ];

  const displayedBadges = allBadgesList;

  const unlockedCount = allBadgesList.filter((b) => b.unlocked).length;

  return (
    <div className="space-y-6">
      {/* ====================================================================
       * Section 1: Hero Banner (National Rank, Points & Progress Mechanics)
       * ==================================================================== */}
      <section className="relative overflow-hidden rounded-[24px_24px_24px_6px] bg-[#005FA3] p-6 sm:p-8 text-white shadow-xs">
        {/* Subtle Ambient Background Orbs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#9CF2F2]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Top Header Row: School Identity & Rank Spotlight */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/15">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#9CF2F2] px-3 py-1 font-mono text-xs font-bold text-[#005FA3] shadow-xs">
                <Crown className="h-3.5 w-3.5 fill-current" />
                <span>Rank #{schoolEntry.rank} of 15 in Sri Lanka</span>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 py-[3px] pl-[3px] pr-3 text-xs font-bold text-[#9CF2F2]">
                <SchoolLogo code={school.code} name={school.name} logoUrl={club.logo_url} size="xs" />
                {school.city}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white font-[var(--font-jakarta)]">
              {school.name} — {club.name}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/85">{club.tagline}</p>
            <p className="text-xs text-white/60">
              Teacher: {club.org_chart[3]?.holder_name}
            </p>
          </div>

          {/* The one number: green points. The meter below says what it is
              worth and what the next reward costs, so neither repeats the
              other. */}
          <div className="shrink-0">
            <div className="rounded-[20px_20px_20px_4px] border border-white/25 bg-white/10 px-6 py-4 text-center backdrop-blur-md">
              <div className="text-[11px] font-semibold text-[#9CF2F2]">Green points</div>
              <div className="mt-1 font-[var(--font-jakarta)] text-3xl font-extrabold tabular-nums text-white sm:text-4xl">
                {currentScore}
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section: Modern Video-Game Inspired Animated XP Fill-Up Meter */}
        <div className="relative z-10 py-4">
          <GameAnimatedXpMeter
            currentScore={currentScore}
            schoolCode={school.code}
            schoolName={school.name}
            onLogActivityClick={onLogActivityClick}
          />
        </div>

        {/* Dynamic Action-Oriented Coaching Callout */}
        <div className="relative z-10 p-4 rounded-2xl bg-white/12 backdrop-blur-md border border-white/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center shrink-0 shadow-md">
              <actionPrompt.icon className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-300">{actionPrompt.badge}</span>
                <span className="text-xs text-white/70">• {actionPrompt.headline}</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                {actionPrompt.text}
              </p>
            </div>
          </div>

          {onLogActivityClick && (
            <button
              onClick={onLogActivityClick}
              className="px-4 py-2 rounded-full bg-[#9CF2F2] hover:bg-white text-[#005FA3] hover:text-[#0B3E6E] text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <span>{actionPrompt.buttonText}</span>
            </button>
          )}
        </div>
      </section>

      {/* ====================================================================
       * Section 2: School Achievement Badges & Medals Showcase
       * Design Reference: Circular Illustrated Medallions with Clean Labels
       * (Matches user reference image: Level Medals, Lieutenant, Adventure Diver)
       * ==================================================================== */}
      <section className="hai-card p-6 sm:p-8 bg-white border border-[#111010]/15 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#111010]/10">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-[#005FA3]" />
              <h2 className="text-xl font-bold tracking-tight text-[#111010] font-[var(--font-jakarta)]">
                Badges
              </h2>
              <span className="rounded-full bg-[#005FA3] px-2.5 py-0.5 font-mono text-xs font-bold text-[#9CF2F2]">
                {unlockedCount} of {allBadgesList.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#111010]/65">
              You earn these by doing real work for your club.
            </p>
          </div>
        </div>

        {/* Circular Badges Grid (Exact Style from User Reference Image) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-8 gap-x-6 py-2">
          {displayedBadges.map((badge) => (
            <div
              key={badge.id}
              onClick={() => setSelectedBadgeModal(badge)}
              className="group flex flex-col items-center text-center cursor-pointer transition-transform duration-300 hover:-translate-y-2 select-none"
              title={`${badge.fullName}: ${badge.desc}`}
            >
              {/* Circular Illustrated Medallion */}
              <div className="relative">
                <div className="transition-transform duration-300 group-hover:scale-105 drop-shadow-sm group-hover:drop-shadow-md">
                  {badge.renderIllustration(88)}
                </div>

                {/* Status Indicator */}
                {badge.unlocked ? (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                ) : (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center border-2 border-white shadow-xs">
                    <Lock className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Title + XP chip. The name reserves a two-line slot so every
                  chip in the grid shares one baseline regardless of wrapping. */}
              <div className="mt-3 flex w-[120px] flex-col items-center gap-1.5">
                <div className="flex h-8 items-center justify-center text-center text-xs font-bold leading-tight text-[#111010] transition-colors group-hover:text-[#005FA3] font-[var(--font-jakarta)]">
                  {badge.name}
                </div>
                <span
                  className={`rounded-full px-2.5 py-[3px] font-mono text-xs font-bold ${
                    badge.unlocked
                      ? 'bg-[#9CF2F2] text-[#005FA3]'
                      : 'bg-[#F0F3F5] text-[#111010]/45'
                  }`}
                >
                  {badgeChipLabel(badge)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ====================================================================
       * Section 3: What the club has actually done — four plain numbers.
       * ==================================================================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="hai-card space-y-1.5 border border-[#111010]/15 bg-white p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#005FA3]">
            <Leaf className="h-4 w-4 text-emerald-600" />
            <span>Waste recycled</span>
          </div>
          <div className="whitespace-nowrap font-[var(--font-jakarta)] text-2xl font-extrabold tabular-nums text-[#111010] sm:text-3xl">
            {schoolEntry.verified_waste_kg}
            <span className="ml-1 text-sm font-normal text-[#111010]/60">kg</span>
          </div>
          <p className="text-xs leading-relaxed text-[#111010]/65">
            That is {schoolEntry.verified_co2_kg} kg of climate pollution kept out of the air.
          </p>
        </div>

        <div className="hai-card space-y-1.5 border border-[#111010]/15 bg-white p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#005FA3]">
            <TrendingUp className="h-4 w-4" />
            <span>Money your club earned</span>
          </div>
          <div className="whitespace-nowrap font-[var(--font-jakarta)] text-2xl font-extrabold tabular-nums text-[#111010] sm:text-3xl">
            {formatLkr(schoolEntry.verified_revenue_usd)}
          </div>
          <p className="text-xs leading-relaxed text-[#111010]/65">
            From {approvedLogsCount} {approvedLogsCount === 1 ? 'activity' : 'activities'} your teacher approved.
          </p>
        </div>

        <div className="hai-card space-y-1.5 border border-[#111010]/15 bg-white p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#005FA3]">
            <Coins className="h-4 w-4 text-amber-600" />
            <span>Grant for your school</span>
          </div>
          <div className="whitespace-nowrap font-[var(--font-jakarta)] text-2xl font-extrabold tabular-nums text-[#111010] sm:text-3xl">
            {formatLkr(school.seed_funding_base_usd + schoolEntry.topoff_funding_amount_usd)}
          </div>
          <p className="text-xs leading-relaxed text-[#111010]/65">
            {formatLkr(school.seed_funding_base_usd)} to start, plus{' '}
            {formatLkr(schoolEntry.topoff_funding_amount_usd)} for reaching your level.
          </p>
        </div>

        <div className="hai-card space-y-1.5 border border-[#111010]/15 bg-white p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#005FA3]">
            <Target className="h-4 w-4 text-[#0F7B6C]" />
            <span>Your place</span>
          </div>
          <div className="whitespace-nowrap font-[var(--font-jakarta)] text-2xl font-extrabold tabular-nums text-[#111010] sm:text-3xl">
            #{schoolEntry.rank}
            <span className="ml-1 text-sm font-normal text-[#111010]/60">of 15</span>
          </div>
          <p className="text-xs leading-relaxed text-[#111010]/65">
            {aboveEntry
              ? `${(aboveEntry.composite_leaderboard_score - currentScore).toFixed(1)} points behind ${aboveEntry.school.name}.`
              : belowEntry
                ? `You are ${(currentScore - belowEntry.composite_leaderboard_score).toFixed(1)} points ahead of ${belowEntry.school.name}.`
                : 'Top of the pilot.'}
          </p>
        </div>
      </div>

      {/* Interactive Badge Details Modal */}
      {selectedBadgeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedBadgeModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-[#111010]/15 space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center">
              <div className="drop-shadow-md">
                {selectedBadgeModal.renderIllustration(100)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#005FA3] bg-[#E6F1FA] px-2 py-0.5 rounded-full">
                  {selectedBadgeModal.category}
                </span>
                <span className="text-[10px] font-bold font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {selectedBadgeModal.xp}
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#111010] font-[var(--font-jakarta)]">
                {selectedBadgeModal.fullName}
              </h3>
              <p className="text-xs text-[#111010]/70 leading-relaxed px-2">
                {selectedBadgeModal.desc}
              </p>
            </div>

            {/* Track Tier Progression Ladder or Milestone Status */}
            {selectedBadgeModal.type === 'track' ? (
              <div className="p-3.5 bg-[#F8FAFC] rounded-2xl border border-[#111010]/10 space-y-2.5 text-left">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#111010]/70">Track Status:</span>
                  <span className="text-[#005FA3] font-bold">
                    {selectedBadgeModal.tierName} ({selectedBadgeModal.currentPoints} pts)
                  </span>
                </div>
                <div className="text-[11px] text-[#111010]/75">
                  {selectedBadgeModal.pointsToNextTier > 0 ? (
                    <span>
                      Next: <strong className="text-[#111010]">{selectedBadgeModal.nextTierName}</strong> — {selectedBadgeModal.pointsToNextTier} pts remaining
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">
                      ★ Maximum Master Tier Achieved!
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-center pt-1">
                  <div className={`p-1.5 rounded ${selectedBadgeModal.tierLevel >= 1 ? 'bg-[#005FA3] text-[#9CF2F2] font-bold shadow-xs' : 'bg-slate-100 text-slate-400'}`}>
                    Tier 1 Novice
                  </div>
                  <div className={`p-1.5 rounded ${selectedBadgeModal.tierLevel >= 2 ? 'bg-[#005FA3] text-[#9CF2F2] font-bold shadow-xs' : 'bg-slate-100 text-slate-400'}`}>
                    Tier 2 Active
                  </div>
                  <div className={`p-1.5 rounded ${selectedBadgeModal.tierLevel >= 3 ? 'bg-[#005FA3] text-[#9CF2F2] font-bold shadow-xs' : 'bg-slate-100 text-slate-400'}`}>
                    Tier 3 Adv.
                  </div>
                  <div className={`p-1.5 rounded ${selectedBadgeModal.tierLevel >= 4 ? 'bg-[#005FA3] text-[#9CF2F2] font-bold shadow-xs' : 'bg-slate-100 text-slate-400'}`}>
                    Tier 4 Master
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#F8FAFC] rounded-2xl border border-[#111010]/10 flex items-center justify-between text-xs font-semibold">
                <span className="text-[#111010]/70">Milestone Status:</span>
                {selectedBadgeModal.unlocked ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Unlocked ({selectedBadgeModal.date})
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Locked Milestone ({selectedBadgeModal.metric})
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => setSelectedBadgeModal(null)}
              className="w-full py-2.5 rounded-full bg-[#005FA3] text-[#9CF2F2] font-bold text-xs hover:bg-[#0B3E6E] transition cursor-pointer"
            >
              Close Badge Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
