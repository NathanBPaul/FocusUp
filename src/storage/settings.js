import { DEFAULT_PROFILE_ID, isProfileId } from "../core/profiles.js";
import { normalizeDomain, MAX_DOMAINS } from "../core/rules.js";
import { normalizeConfig, presetName, MAX_CUSTOM_PRESETS } from "../core/presets.js";
function readDomainList(values) {
  const domains = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    try {
      domains.add(normalizeDomain(value));
    } catch {
      /* Ignore malformed stored entries. */
    }
  }
  return [...domains].slice(0, MAX_DOMAINS);
}
export async function getSettings() {
  const stored = await chrome.storage.local.get([
    "activeProfileId",
    "blockedDomains",
    "allowedDomains",
    "youtube",
    "instagram",
    "customPresets",
    "presetUndo",
  ]);
  const blockedDomains = {};
  for (const id of ["focus", "personal"]) {
    blockedDomains[id] = readDomainList(stored.blockedDomains?.[id]);
  }
  const youtube = {};
  for (const id of ["focus", "personal"]) {
    try {
      youtube[id] = globalThis.FocusUpYouTube.normalize(stored.youtube?.[id]);
    } catch {
      youtube[id] = globalThis.FocusUpYouTube.defaults();
    }
  }
  const instagram = {};
  for (const id of ["focus", "personal"]) {
    try {
      instagram[id] = globalThis.FocusUpInstagram.normalize(stored.instagram?.[id]);
    } catch {
      instagram[id] = globalThis.FocusUpInstagram.defaults();
    }
  }
  const allowedDomains = {};
  for (const id of ["focus", "personal"]) {
    allowedDomains[id] = readDomainList(stored.allowedDomains?.[id]);
  }
  const customPresets = [];
  for (const item of Array.isArray(stored.customPresets) ? stored.customPresets : []) {
    try {
      if (
        typeof item.id !== "string" ||
        !/^custom-[\w-]{1,80}$/.test(item.id) ||
        customPresets.some((saved) => saved.id === item.id)
      ) {
        continue;
      }
      customPresets.push({
        id: item.id,
        name: presetName(item.name),
        config: normalizeConfig(item.config),
      });
    } catch {
      /* Ignore malformed saved presets. */
    }
    if (customPresets.length >= MAX_CUSTOM_PRESETS) {
      break;
    }
  }
  const presetUndo = {};
  for (const id of ["focus", "personal"]) {
    const entry = stored.presetUndo?.[id];
    if (entry) {
      try {
        presetUndo[id] = {
          before: normalizeConfig(entry.before),
          after: normalizeConfig(entry.after),
        };
      } catch {
        /* Ignore malformed undo records. */
      }
    }
  }
  return {
    activeProfileId: isProfileId(stored.activeProfileId)
      ? stored.activeProfileId
      : DEFAULT_PROFILE_ID,
    blockedDomains,
    allowedDomains,
    youtube,
    instagram,
    customPresets,
    presetUndo,
  };
}
export async function getActiveProfileId() {
  return (await getSettings()).activeProfileId;
}
export async function requestSettings(action = "get", values = {}) {
  const response = await chrome.runtime.sendMessage({
    type: "focusup-settings",
    action,
    ...values,
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Unable to update blocking rules.");
  }
  return response.settings;
}
