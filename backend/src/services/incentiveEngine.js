// UC-003: full-timer incentive pay, computed from performance inputs
// (sessions delivered, enrolments, sales, KPI results) — never from hours.
// Pure function: no database access, so it's unit-testable on its own.
// The scheme's rule_definition shape is documented in models/IncentiveScheme.js.

/**
 * Works out one full-timer's incentive for one pay period.
 *
 * Distinction that matters (use case flows 2a/3a):
 * - ZERO performance inputs is a valid outcome (they earned no incentive)
 *   => incentiveCents 0, no missing metrics, line stays complete.
 * - A metric listed in the scheme's requiredMetrics that has NO input is a
 *   data problem => reported in missingMetrics so the caller can flag the
 *   line incomplete instead of silently underpaying.
 *
 * @param {object} args
 * @param {Array<{metricType: string, metricValue: string|number}>} args.performanceInputs
 *   this staff member's inputs for the period (metricValue arrives as a
 *   string from DECIMAL columns).
 * @param {{ruleDefinition: object}} args.scheme - the active incentive scheme.
 * @returns {{incentiveCents: number, missingMetrics: string[]}}
 */
function calculateIncentive({ performanceInputs, scheme }) {
  const rules = scheme.ruleDefinition || {};
  const metricRules = rules.metrics || {};
  const requiredMetrics = rules.requiredMetrics || [];

  const inputsByType = new Map(
    performanceInputs.map((input) => [input.metricType, Number(input.metricValue)])
  );

  const missingMetrics = requiredMetrics.filter((metric) => !inputsByType.has(metric));
  if (missingMetrics.length > 0) {
    return { incentiveCents: 0, missingMetrics };
  }

  let incentiveCents = 0;

  for (const [metricType, rule] of Object.entries(metricRules)) {
    if (!inputsByType.has(metricType)) continue; // optional metric with no input => contributes nothing

    const value = inputsByType.get(metricType);

    if (rule.type === 'per_unit') {
      // e.g. $15.00 per session delivered. Rounded at the cent in case the
      // count ever carries decimals (e.g. half-sessions).
      incentiveCents += Math.round(value * rule.rateCents);
    } else if (rule.type === 'percentage') {
      // e.g. 2% of sales. The sales metricValue is in CENTS, and basis
      // points keep the rate integer (200 bp = 2%), so this is exact maths.
      incentiveCents += Math.round((value * rule.basisPoints) / 10000);
    } else if (rule.type === 'tiered') {
      // e.g. KPI >= 80 pays a $500 bonus. Highest tier reached wins —
      // tiers don't stack.
      const tierReached = [...rule.tiers]
        .sort((a, b) => b.min - a.min)
        .find((tier) => value >= tier.min);
      if (tierReached) incentiveCents += tierReached.bonusCents;
    }
    // Unknown rule types are ignored on purpose: an old engine version
    // should never misprice a newer scheme; the tests pin the known types.
  }

  return { incentiveCents, missingMetrics: [] };
}

module.exports = { calculateIncentive };
