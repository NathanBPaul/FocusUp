export const MAX_DOMAINS = 500;
export function normalizeDomain(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Enter a website domain.");
  const input = value.trim();
  let url;
  try { url = new URL(input.includes("://") ? input : `https://${input}`); }
  catch { throw new Error("Enter a valid domain, such as example.com."); }
  const domain = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      !domain.includes(".") || domain.length > 253 ||
      !domain.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error("Enter a valid domain, such as example.com.");
  }
  return domain;
}
export function evaluateAccess({ hostname }, rules = []) {
  if (typeof hostname !== "string" || !hostname) throw new TypeError("hostname required");
  const host = hostname.toLowerCase().replace(/\.$/, "");
  for (const rule of rules) {
    const domain = rule?.matches?.hostname;
    if (domain && (host === domain || host.endsWith(`.${domain}`)) && ["allow", "block"].includes(rule.effect))
      return { allowed: rule.effect === "allow", ruleId: rule.id ?? null, reason: "matched-rule" };
  }
  return { allowed: true, ruleId: null, reason: "no-matching-rule" };
}
export function buildDynamicRules(domains, profileId, extensionUrl) {
  return domains.map((domain, index) => ({
    id: index + 1, priority: 1,
    action: { type: "redirect", redirect: { url: `${extensionUrl}blocked/blocked.html?mode=${profileId}&domain=${encodeURIComponent(domain)}` } },
    condition: { requestDomains: [domain], resourceTypes: ["main_frame"] }
  }));
}
