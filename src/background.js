import { isProfileId } from "./core/profiles.js";
import { buildDynamicRules, normalizeDomain, MAX_DOMAINS } from "./core/rules.js";
import { getSettings } from "./storage/settings.js";
let pending = Promise.resolve();
function enqueue(task) {
  const result = pending.then(task);
  pending = result.catch(error => console.error("FocusUp rule sync failed:", error));
  return result;
}
export async function syncRules(settings) {
  const current = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: current.map(rule => rule.id),
    addRules: buildDynamicRules(settings.blockedDomains[settings.activeProfileId], settings.activeProfileId, chrome.runtime.getURL(""))
  });
}
async function handleSettings(message) {
  const previous = await getSettings();
  const next = structuredClone(previous);
  if (message.action === "instagram") {
    if (!isProfileId(message.profileId)) throw new Error("Unknown mode.");
    next.instagram[message.profileId] = globalThis.FocusUpInstagram.normalize(message.config);
  } else if (message.action === "youtube") {
    if (!isProfileId(message.profileId)) throw new Error("Unknown mode.");
    next.youtube[message.profileId] = globalThis.FocusUpYouTube.normalize(message.config);
  } else if (message.action === "mode") {
    if (!isProfileId(message.profileId)) throw new Error("Unknown mode.");
    next.activeProfileId = message.profileId;
  } else if (["add", "remove"].includes(message.action)) {
    if (!isProfileId(message.profileId)) throw new Error("Unknown mode.");
    const domain = normalizeDomain(message.domain);
    const list = next.blockedDomains[message.profileId];
    if (message.action === "add") {
      if (list.includes(domain)) throw new Error("This domain is already in this mode's list.");
      if (list.length >= MAX_DOMAINS) throw new Error(`Each mode supports up to ${MAX_DOMAINS} domains.`);
      list.push(domain);
    } else next.blockedDomains[message.profileId] = list.filter(item => item !== domain);
  } else if (message.action !== "get") throw new Error("Unknown settings action.");
  await syncRules(next);
  try {
    if (message.action !== "get") await chrome.storage.local.set(next);
  } catch (error) {
    await syncRules(previous);
    throw error;
  }
  return next;
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "focusup-settings" || sender.id !== chrome.runtime.id) return;
  enqueue(() => handleSettings(message)).then(
    settings => sendResponse({ ok: true, settings }),
    error => sendResponse({ ok: false, error: error.message })
  );
  return true;
});
chrome.runtime.onInstalled.addListener(() => enqueue(async () => syncRules(await getSettings())));
chrome.runtime.onStartup.addListener(() => enqueue(async () => syncRules(await getSettings())));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.activeProfileId || changes.blockedDomains))
    enqueue(async () => syncRules(await getSettings()));
});
enqueue(async () => syncRules(await getSettings()));
