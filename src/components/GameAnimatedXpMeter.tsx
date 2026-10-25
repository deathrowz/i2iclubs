'use client';

import React, { useEffect, useId, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  GAMIFICATION_TIERS,
  GamificationTierName,
  MAX_TIER_SCORE,
  getGamificationTier,
  getTierProgress,
} from '@/lib/gamification/tiers';

export interface GameAnimatedXpMeterProps {
  currentScore: number;
  schoolCode?: string;
  /** Named in the reward line. Falls back to "your school". */
  schoolName?: string;
  onLogActivityClick?: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Metal per tier. The rail turns the colour of the tier you have reached. */
const METAL: Record<GamificationTierName, { from: string; to: string; glow: string }> = {
  Bronze: { from: '#A85E30', to: '#EEA968', glow: 'rgba(238, 169, 104, 0.5)' },
  Silver: { from: '#869EB4', to: '#EAF3FB', glow: 'rgba(234, 243, 251, 0.45)' },
  Gold: { from: '#BC8015', to: '#FBE192', glow: 'rgba(251, 225, 146, 0.55)' },
  Platinum: { from: '#56A7BF', to: '#EAFDFF', glow: 'rgba(234, 253, 255, 0.55)' },
};

/** The emblem cut for each tier — a shard, a gem, a star, a rosette. */
const GATE_SHAPE: Record<GamificationTierName, string> = {
  Bronze: 'M12 2.5 L21 9 L17.5 21 L6.5 21 L3 9 Z',
  Silver: 'M12 1.5 L22 12 L12 22.5 L2 12 Z',
  Gold: 'M12 1.6 L14.7 9.3 L22.4 12 L14.7 14.7 L12 22.4 L9.3 14.7 L1.6 12 L9.3 9.3 Z',
  Platinum: 'M12 1.5 L18.2 5.8 L22.5 12 L18.2 18.2 L12 22.5 L5.8 18.2 L1.5 12 L5.8 5.8 Z',
};

/**
 * The XP rail doubles as the funding ladder: every checkpoint on it is a
 * seed-grant cheque, so the number a student chases is money for their school.
 *
 * Three states carry the story without a legend — a checkpoint struck in its
 * metal is cleared, the next one is an outlined pulse you are heading for, and
 * the rest are engraved sockets. The rail itself takes the metal of the tier
 * reached, so the bar reads out progress on its own.
 */
export function GameAnimatedXpMeter({
  currentScore,
  schoolCode = 'SCH-01',
  schoolName,
  onLogActivityClick,
}: GameAnimatedXpMeterProps) {
  const { current, next } = getGamificationTier(currentScore);
  const { pointsRemaining } = getTierProgress(currentScore);

  const absolutePct = Math.min(100, Math.max(0, (currentScore / MAX_TIER_SCORE) * 100));

  const [displayedScore, setDisplayedScore] = useState(currentScore);
  // Start empty so the rail visibly fills on mount.
  const [fillPct, setFillPct] = useState(0);

  const uid = useId().replace(/[:]/g, '');

  // Roll-up counter. Skipped (jumps straight to the value) under reduced motion.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayedScore(currentScore);
      setFillPct(absolutePct);
      return;
    }
    let raf: number;
    const startValue = displayedScore;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayedScore(Number((startValue + (currentScore - startValue) * eased).toFixed(1)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScore]);

  // Ease the rail to its target on mount / score change.
  useEffect(() => {
    const id = setTimeout(() => setFillPct(absolutePct), prefersReducedMotion() ? 0 : 60);
    return () => clearTimeout(id);
  }, [absolutePct]);

  const metal = METAL[current.tier];
  const displayedRemaining = next ? Math.max(0, Number((next.threshold - displayedScore).toFixed(1))) : 0;

  return (
    <div
      className="relative overflow-hidden rounded-[22px_22px_22px_6px] border border-white/20 p-5 sm:p-6"
      style={{
        background: 'linear-gradient(180deg, rgba(0, 32, 58, 0.62) 0%, rgba(0, 20, 38, 0.5) 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.25), 0 16px 36px -20px rgba(0,0,0,0.7)',
      }}
      title={`${schoolCode} — ${current.title}`}
    >
      {/* Tier-coloured wash, so the panel belongs to the level you are in. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-12 h-48 w-72 rounded-full opacity-50 blur-3xl"
        style={{ background: `radial-gradient(circle, ${metal.glow} 0%, transparent 72%)` }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Header: the level you hold, and what it takes to leave it.          */}
      {/* The total score lives in the hero above, so this panel does not     */}
      {/* repeat it — it shows the gap to the next cheque instead.            */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between md:gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold leading-tight text-[#9CF2F2]">
            Level {current.level} of {GAMIFICATION_TIERS.length}
          </div>
          <div className="truncate font-[var(--font-jakarta)] text-lg font-extrabold leading-tight tracking-tight text-white md:text-xl">
            {current.title}
          </div>
        </div>

        <div className="shrink-0 md:text-right">
          {next ? (
            <div className="flex items-baseline gap-2 md:block">
              <span className="font-[var(--font-jakarta)] text-[28px] font-extrabold leading-none tracking-tight text-white tabular-nums md:text-[38px]">
                {displayedRemaining.toFixed(1)}
              </span>
              <span className="text-[11px] font-semibold leading-tight text-white/60">
                XP to <span className="text-[#9CF2F2]">{next.title}</span>
              </span>
            </div>
          ) : (
            <>
              <div className="font-[var(--font-jakarta)] text-[26px] font-extrabold leading-none tracking-tight text-[#9CF2F2] sm:text-[30px]">
                Top tier
              </div>
              <div className="mt-1 text-[11px] font-semibold leading-tight text-white/60">
                {current.grantLkr} secured
              </div>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* The funding rail                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative mt-5 mx-[15px]">
        {/* The track, sunk into a shallow trough so it reads as a slot in the
            panel rather than a line drawn on top of it. */}
        <div
          className="relative rounded-full p-[3px]"
          style={{
            background: 'rgba(0, 20, 38, 0.45)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={MAX_TIER_SCORE}
            aria-valuenow={Math.round(currentScore)}
            aria-label={`Green Points: ${Math.round(currentScore)} of ${MAX_TIER_SCORE}. ${
              next ? `${pointsRemaining} to ${next.title}` : 'Top tier reached'
            }.`}
            className="relative h-[14px] w-full rounded-full"
            style={{
              background: '#013B63',
              boxShadow:
                'inset 0 2px 4px rgba(0, 0, 0, 0.6), inset 0 -1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px rgba(255,255,255,0.10)',
            }}
          >
            {/* Earned metal, mapped to the full scale and revealed by a clip, so
                the colour under any point is that tier's metal. */}
            <div
              aria-hidden
              className="xp-rail-fill absolute inset-0 overflow-hidden rounded-full"
              style={{ clipPath: `inset(0 ${100 - fillPct}% 0 0 round 9999px)` }}
            >
              <div className="absolute inset-0" style={{ backgroundImage: railGradient() }} />
              {/* a single line of light, not a plastic sheen */}
              <div className="absolute inset-x-0 top-0 h-px bg-white/45" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-black/20" />
            </div>

            {/* Travelling marker: your score, physically on the rail. */}
            <span
              aria-hidden
              className="xp-marker absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${fillPct}%` }}
            >
              <span
                className="animate-xp-pod block h-[22px] w-[8px] rounded-full bg-white"
                style={{ boxShadow: `0 0 10px 2px ${metal.glow}, 0 0 0 1px rgba(255,255,255,0.95)` }}
              />
            </span>
          </div>

          {/* Checkpoints sit in the track like set stones. */}
          {GAMIFICATION_TIERS.map((tier) => {
            const pct = (tier.threshold / MAX_TIER_SCORE) * 100;
            const cleared = currentScore >= tier.threshold;
            const isNext = !cleared && next?.level === tier.level;
            const tierMetal = METAL[tier.tier];
            const igniteDelay = Math.round((pct / 100) * 900) + 120;
            const isCurrent = tier.level === current.level;

            return (
              <div
                key={tier.level}
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  left: `${pct}%`,
                  transform: `translate(${pct < 4 ? '0%' : pct > 96 ? '-100%' : '-50%'}, -50%)`,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className={`h-[30px] w-[30px] ${cleared ? 'animate-xp-gate' : ''} ${isNext ? 'animate-xp-goal' : ''}`}
                  style={{
                    animationDelay: cleared ? `${igniteDelay}ms` : undefined,
                    filter: cleared
                      ? `drop-shadow(0 0 8px ${tierMetal.glow}) drop-shadow(0 1px 2px rgba(0,0,0,0.6))`
                      : 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                  }}
                >
                  <defs>
                    <linearGradient id={`${uid}-gate-${tier.level}`} x1="0" y1="0" x2="0.55" y2="1">
                      <stop offset="0%" stopColor={tierMetal.to} />
                      <stop offset="100%" stopColor={tierMetal.from} />
                    </linearGradient>
                  </defs>
                  <path
                    d={GATE_SHAPE[tier.tier]}
                    fill={cleared ? `url(#${uid}-gate-${tier.level})` : '#013B63'}
                    stroke={
                      cleared ? 'rgba(255,255,255,0.85)' : isNext ? tierMetal.to : 'rgba(255,255,255,0.5)'
                    }
                    strokeWidth={isNext ? 1.6 : 1.3}
                    strokeLinejoin="round"
                    strokeDasharray={isNext ? '3 2' : undefined}
                  />
                  {cleared && (
                    <path d="M12 2.5 L17 10 L12 13 L7 10 Z" fill="rgba(255,255,255,0.4)" />
                  )}
                  {isCurrent && (
                    <path
                      d={GATE_SHAPE[tier.tier]}
                      fill="none"
                      stroke="rgba(255,255,255,0.45)"
                      strokeWidth="0.9"
                      transform="translate(12 12) scale(1.2) translate(-12 -12)"
                    />
                  )}
                </svg>
              </div>
            );
          })}
        </div>

        {/* Checkpoint captions: the prize at each threshold. */}
        <div className="relative mt-2 h-7">
          {GAMIFICATION_TIERS.map((tier) => {
            const pct = (tier.threshold / MAX_TIER_SCORE) * 100;
            const cleared = currentScore >= tier.threshold;
            const isNext = !cleared && next?.level === tier.level;

            return (
              <div
                key={tier.level}
                className={`absolute top-0 whitespace-nowrap ${
                  !cleared && !isNext ? 'hidden md:block' : ''
                }`}
                style={{
                  left: `${pct}%`,
                  transform: `translateX(${pct < 4 ? '0%' : pct > 96 ? '-100%' : '-50%'})`,
                }}
              >
                <div
                  className={`text-[10px] font-bold leading-tight ${
                    cleared ? 'text-white' : isNext ? 'text-[#9CF2F2]' : 'text-white/40'
                  }`}
                >
                  {tier.tier}
                </div>
                <div
                  className={`hidden text-[10px] leading-tight tabular-nums md:block ${
                    cleared ? 'text-white/65' : isNext ? 'text-[#9CF2F2] font-bold' : 'text-white/25'
                  }`}
                >
                  {shortGrant(tier.grantLkr)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* What the next checkpoint is worth, and the one action.              */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative mt-2 flex flex-col gap-3 border-t border-white/10 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-white/75">
          {next ? (
            <>
              <span className="font-semibold text-[#9CF2F2]">{next.title}</span> unlocks{' '}
              <strong className="font-semibold text-white">{next.grantLkr}</strong> for{' '}
              {schoolName ?? 'your school'}
            </>
          ) : (
            <>
              Top tier reached — <strong className="font-semibold text-[#9CF2F2]">{current.grantLkr}</strong>{' '}
              secured for {schoolName ?? 'your school'}
            </>
          )}
        </p>

        {onLogActivityClick && (
          <button
            onClick={onLogActivityClick}
            className="group inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#9CF2F2] px-4 py-2 text-xs font-extrabold text-[#00467A] shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Log an activity
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * One gradient across the whole rail, banded by tier, so the colour under the
 * marker is always the metal of the level that position belongs to.
 */
function railGradient(): string {
  const stops: string[] = [];
  GAMIFICATION_TIERS.forEach((tier, index) => {
    const start = (tier.threshold / MAX_TIER_SCORE) * 100;
    const end =
      index + 1 < GAMIFICATION_TIERS.length
        ? (GAMIFICATION_TIERS[index + 1].threshold / MAX_TIER_SCORE) * 100
        : 100;
    const { from, to } = METAL[tier.tier];
    stops.push(`${from} ${start}%`);
    stops.push(`${to} ${Math.max(start, end - 0.4)}%`);
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** "Rs. 1,050,000" → "Rs 1.05M". Captions sit 16% apart at the top of the
 *  ladder, so the full amount collides; the short form stays legible. */
function shortGrant(label: string): string {
  const amount = Number(label.replace(/[^0-9]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return label;
  if (amount >= 1_000_000) {
    return `Rs ${(amount / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  }
  return `Rs ${Math.round(amount / 1000)}k`;
}
