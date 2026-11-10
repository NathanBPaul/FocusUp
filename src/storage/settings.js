import { DEFAULT_PROFILE_ID, isProfileId } from "../core/profiles.js";
import { normalizeDomain, MAX_DOMAINS } from "../core/rules.js";
import "../core/youtube.js";
export async function getSettings() {
  const stored = await chrome.storage.local.get(["activeProfileId", "blockedDomains", "youtube"]);
  const blockedDomains = {};
  for (const id of ["focus", "personal"]) {
    blockedDomains[id] = [];
    for (const value of Array.isArray(stored.blockedDomains?.[id]) ? stored.blockedDomains[id] : []) {
      try {
        const domain = normalizeDomain(value);
        if (!blockedDomains[id].includes(domain)) blockedDomains[id].push(domain);
      } catch { /* Ignore malformed stored entries. */ }
    }
    blockedDomains[id] = blockedDomains[id].slice(0, MAX_DOMAINS);
  }
  const youtube = {};
  for (const id of ["focus", "personal"]) {
    try { youtube[id] = globalThis.FocusUpYouTube.normalize(stored.youtube?.[id]); }
    catch { youtube[id] = globalThis.FocusUpYouTube.defaults(); }
  }
  return { activeProfileId: isProfileId(stored.activeProfileId) ? stored.activeProfileId : DEFAULT_PROFILE_ID, blockedDomains, youtube };
}
export async function getActiveProfileId() { return (await getSettings()).activeProfileId; }
export async function requestSettings(action = "get", values = {}) {
  const response = await chrome.runtime.sendMessage({ type: "focusup-settings", action, ...values });
  if (!response?.ok) throw new Error(response?.error || "Unable to update blocking rules.");
  return response.settings;
}
export async function setActiveProfileId(id) { await requestSettings("mode", { profileId: id }); }
