import assert from 'node:assert/strict';
import { computeSchoolLeaderboard } from '../gamification/engine';
import { GAMIFICATION_TIERS, MAX_TIER_SCORE, getGamificationTier } from '../gamification/tiers';
import {
  APPROVED_HISTORICAL_LOGS,
  INITIAL_GAMIFICATION_CONFIG,
  INITIAL_IMPACT_LOGS,
  PILOT_CLUBS,
  PILOT_SCHOOLS,
} from '../store/seed-data';

/**
 * The seeded leaderboard has to look like a competition, not a plateau.
 *
 * The six-criteria baseline is awarded to every club at once, so weighting it
 * too heavily pushed eight of the fifteen schools past MAX_TIER_SCORE before a
 * single activity was verified — every dashboard read as "maxed out".
 */
function run() {
  const board = computeSchoolLeaderboard({
    schools: PILOT_SCHOOLS,
    clubs: PILOT_CLUBS,
    impactLogs: [...INITIAL_IMPACT_LOGS, ...APPROVED_HISTORICAL_LOGS],
    config: INITIAL_GAMIFICATION_CONFIG,
  });

  assert.equal(board.length, PILOT_SCHOOLS.length, 'every school must be ranked');
  assert.equal(board[0].rank, 1);

  const scores = board.map((entry) => entry.composite_leaderboard_score);

  // 1. Nobody is pinned at the top of the ladder.
  const capped = scores.filter((score) => score >= MAX_TIER_SCORE);
  assert.deepEqual(capped, [], `${capped.length} school(s) at or above MAX_TIER_SCORE`);

  // 2. The field spans several tiers.
  const tiers = new Set(board.map((entry) => getGamificationTier(entry.composite_leaderboard_score).current.tier));
  assert.ok(
    tiers.size >= 3,
    `expected at least 3 tiers across the pilot, saw ${[...tiers].join(', ')}`
  );

  // 3. There is a real gap between first and last.
  const spread = scores[0] - scores[scores.length - 1];
  assert.ok(spread >= 100, `first-to-last spread is only ${spread.toFixed(1)} points`);

  // 4. Every tier in the ladder is reachable, so the thresholds still fit the model.
  const topTier = GAMIFICATION_TIERS[GAMIFICATION_TIERS.length - 1].tier;
  assert.ok(tiers.has(topTier), 'the leading school should reach the top tier');

  console.log(
    `✅ leaderboard-spread.test.ts passed (${scores[0].toFixed(1)} → ${scores[scores.length - 1].toFixed(1)}, ${tiers.size} tiers)`
  );
}

run();
