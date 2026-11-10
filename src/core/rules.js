/**
 * Preliminary pure rule evaluator. First exact-hostname match wins.
 * Rule shape: { id, effect: "allow"|"block", matches: { hostname } }.
 * No rules are enabled or enforced in v0.1.
 */
export function evaluateAccess({ hostname }, rules = []) {
  if (typeof hostname !== "string" || !hostname) throw new TypeError("hostname required");
  for (const rule of rules) {
    if (rule?.matches?.hostname === hostname && ["allow", "block"].includes(rule.effect))
      return { allowed: rule.effect === "allow", ruleId: rule.id ?? null, reason: "matched-rule" };
  }
  return { allowed: true, ruleId: null, reason: "no-matching-rule" };
}
