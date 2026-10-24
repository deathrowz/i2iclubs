import assert from 'node:assert/strict';
import {
  GAMIFICATION_TIERS,
  MAX_TIER_SCORE,
  getGamificationTier,
  getTierProgress,
} from '../gamification/tiers';

function run() {
  // 1. Ladder has exactly the four funding tiers, in ascending order.
  assert.equal(GAMIFICATION_TIERS.length, 4);
  assert.deepEqual(
    GAMIFICATION_TIERS.map((t) => t.tier),
    ['Bronze', 'Silver', 'Gold', 'Platinum']
  );
  for (let i = 1; i < GAMIFICATION_TIERS.length; i += 1) {
    assert.ok(
      GAMIFICATION_TIERS[i].threshold > GAMIFICATION_TIERS[i - 1].threshold,
      'thresholds must ascend'
    );
  }

  // 2. Tier resolution at and around the boundaries.
  assert.equal(getGamificationTier(0).current.tier, 'Bronze');
  assert.equal(getGamificationTier(259.9).current.tier, 'Bronze');
  assert.equal(getGamificationTier(260).current.tier, 'Silver');
  assert.equal(getGamificationTier(340).current.tier, 'Gold');
  assert.equal(getGamificationTier(420).current.tier, 'Platinum');
  assert.equal(getGamificationTier(9999).current.tier, 'Platinum');

  // 3. Next tier is only null at the top.
  assert.equal(getGamificationTier(0).next?.tier, 'Silver');
  assert.equal(getGamificationTier(419.9).next?.tier, 'Platinum');
  assert.equal(getGamificationTier(420).next, null);

  // 4. Within-level progress spans 0–100 and reports remaining points.
  assert.equal(getTierProgress(420).pct, 100);
  assert.equal(getTierProgress(420).pointsRemaining, 0);
  assert.equal(getTierProgress(300).pct, 50); // 300 = halfway through Silver (260 → 340)
  assert.equal(getTierProgress(300).pointsRemaining, 40);
  assert.equal(getTierProgress(0).pct, 0);
  assert.equal(getTierProgress(260).pointsRemaining, 80); // Silver → Gold

  // 5. Full scale constant is the top of Platinum.
  assert.equal(MAX_TIER_SCORE, 500);

  console.log('✅ tiers.test.ts passed');
}

run();
