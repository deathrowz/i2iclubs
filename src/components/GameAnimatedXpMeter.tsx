'use client';

import React, { useEffect, useState } from 'react';
import { Award, Check, ChevronRight, Crown, Lock, Sparkles } from 'lucide-react';
import {
  GAMIFICATION_TIERS,
  MAX_TIER_SCORE,
  getGamificationTier,
  getTierProgress,
} from '@/lib/gamification/tiers';

export interface GameAnimatedXpMeterProps {
  currentScore: number;
  schoolCode?: string;
  onLogActivityClick?: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * On-brand progress meter for the student gamification hero.
 *
 * The visual language matches the rest of the platform (light surfaces, the
 * #005FA3 / #9CF2F2 accent pair, asymmetric card radius) instead of the
 * dark "arcade chrome" treatment. Progress is derived from a single tier
 * ladder (`@/lib/gamification/tiers`) so level names and thresholds never
 * drift between surfaces. All motion respects `prefers-reduced-motion`.
 */
export function GameAnimatedXpMeter({
  currentScore,
  schoolCode = 'SCH-01',
  onLogActivityClick,
}: GameAnimatedXpMeterProps) {
  const { current, next } = getGamificationTier(currentScore);
  const { pointsRemaining } = getTierProgress(currentScore);

  // Absolute position of the needle across the full 0 → MAX scale.
  const absolutePct = Math.min(100, Math.max(2, (currentScore / MAX_TIER_SCORE) * 100));

  const [displayedScore, setDisplayedScore] = useState(currentScore);
  // Start empty so the rail visibly fills on mount.
  const [fillPct, setFillPct] = useState(0);

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

  // Ease the fill bar to its target on mount / score change.
  useEffect(() => {
    const id = setTimeout(() => setFillPct(absolutePct), prefersReducedMotion() ? 0 : 60);
    return () => clearTimeout(id);
  }, [absolutePct]);

  return (
    <div className="hai-card p-5 sm:p-6 bg-white">
      {/* Header: level jewel + score counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-[14px_14px_14px_4px] bg-[#005FA3] text-[#9CF2F2] flex flex-col items-center justify-center shadow-xs"
            title={`${schoolCode} — ${current.title}`}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest leading-none">Lvl</span>
            <span className="text-lg font-extrabold font-mono leading-tight">{current.level}</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#005FA3] font-[var(--font-jakarta)]">
                {current.title}
              </span>
              <span className="hai-tag font-mono text-[10px]">{current.tier}</span>
            </div>
            <div className="text-xs text-[#111010]/70 mt-0.5">
              {next
                ? `${pointsRemaining} pts to ${next.title} (${next.grantLkr})`
                : `Top tier reached — ${current.grantLkr} unlocked`}
            </div>
          </div>
        </div>

        <div className="text-right animate-xp-score" style={{ transformOrigin: 'right center' }}>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#111010]/60">
            Green Points
          </div>
          <div className="font-mono">
            <span className="text-3xl font-extrabold text-[#005FA3]">
              {displayedScore.toFixed(1)}
            </span>
            <span className="text-xs text-[#111010]/50 font-semibold"> / {MAX_TIER_SCORE} XP</span>
          </div>
        </div>
      </div>

      {/* Progress rail with milestone nodes */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-[#005FA3] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {pointsRemaining > 0
              ? `${pointsRemaining} pts to ${next?.title}`
              : 'Platinum tier achieved'}
          </span>
          <span className="font-mono text-[#111010]/60 font-semibold">{absolutePct.toFixed(0)}%</span>
        </div>

        <div className="relative w-full h-6 rounded-full bg-[#E6F1FA] border border-[#005FA3]/20">
          {/* Fill bar with a one-shot shine sweep across the filled portion */}
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-[#005FA3] to-[#0E7AC7] overflow-hidden transition-[width] duration-700 ease-out"
            style={{ width: `${fillPct}%` }}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent animate-xp-shine"
            />
          </div>

          {/* Leading-edge spark — slow idle breathing glow after the entry fill */}
          <span
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-[left] duration-700 ease-out"
            style={{ left: `${fillPct}%` }}
          >
            <span className="block w-4 h-4 rounded-full bg-white animate-xp-spark" />
          </span>

          {/* Milestone nodes for each tier */}
          {GAMIFICATION_TIERS.map((tier) => {
            const nodePct = (tier.threshold / MAX_TIER_SCORE) * 100;
            const unlocked = currentScore >= tier.threshold;
            // Pop as the fill reaches the node (fill transition ≈ 700ms).
            const popDelayMs = Math.round((nodePct / 100) * 700) + 60;
            return (
              <div
                key={tier.level}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${Math.max(3, Math.min(97, nodePct))}%` }}
                title={`${tier.title} — ${tier.grantLkr}`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border-2 bg-white transition ${
                    unlocked
                      ? 'border-[#005FA3] text-[#005FA3]'
                      : 'border-[#005FA3]/30 text-[#111010]/40'
                  } ${unlocked ? 'animate-xp-gem' : ''}`}
                  style={unlocked ? { animationDelay: `${popDelayMs}ms` } : undefined}
                >
                  {unlocked ? (
                    tier.level === 4 ? (
                      <Crown className="w-3 h-3" />
                    ) : (
                      <Check className="w-3 h-3" strokeWidth={3} />
                    )
                  ) : (
                    <Lock className="w-2.5 h-2.5" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Milestone labels */}
        <div className="relative flex justify-between text-[10px] font-mono text-[#111010]/60 mt-2 px-1">
          {GAMIFICATION_TIERS.map((tier) => (
            <div
              key={tier.level}
              className={`text-center ${currentScore >= tier.threshold ? 'text-[#005FA3] font-bold' : ''}`}
            >
              <div>{tier.tier}</div>
              <div>{tier.threshold} XP</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: next reward + CTA */}
      <div className="mt-4 pt-4 border-t border-[#111010]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs text-[#111010]/70 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-[#005FA3]" />
          {next
            ? `Next reward: ${next.title} unlocks ${next.grantLkr} top-off funding`
            : 'Maximum national tier unlocked'}
        </span>

        {onLogActivityClick && (
          <button
            onClick={onLogActivityClick}
            className="hai-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Log Activity for XP</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
