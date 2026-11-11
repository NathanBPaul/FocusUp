import { isProfileId } from "./core/profiles.js";
import { buildDynamicRules, normalizeDomain, MAX_DOMAINS } from "./core/rules.js";
import { getSettings } from "./storage/settings.js";
import {
  previewPreset,
  modeConfig,
  configKey,
  presetName,
  resolvePreset,
  MAX_CUSTOM_PRESETS,
} from "./core/presets.js";
let pending = Promise.resolve();
function enqueue(task) {
  const result = pending.then(task);
  pending = result.catch((error) => console.error("FocusUp rule sync failed:", error));
  return result;
}
export async function syncRules(settings) {
  const current = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: current.map((rule) => rule.id),
    addRules: buildDynamicRules(
      settings.blockedDomains[settings.activeProfileId],
      settings.activeProfileId,
      chrome.runtime.getURL(""),
      settings.allowedDomains[settings.activeProfileId],
    ),
  });
}
async function handleSettings(message) {
  const previous = await getSettings();
  const next = structuredClone(previous);
  function requireMode() {
    if (!isProfileId(message.profileId)) {
      throw new Error("Choose Focus Mode or Personal Mode.");
    }
  }
  function setModeConfig(config) {
    for (const key of ["blockedDomains", "allowedDomains", "youtube", "instagram"]) {
      next[key][message.profileId] = structuredClone(config[key]);
    }
  }
  if (message.action === "presetPreview") {
    requireMode();
    return { ...next, presetPreview: previewPreset(next, message.profileId, message.reference) };
  } else if (message.action === "presetApply") {
    requireMode();
    const preview = previewPreset(next, message.profileId, message.reference);
    if (preview.key !== message.previewKey) {
      throw new Error(
        "Your settings or preset changed. Review the preview again before applying it.",
      );
    }
    setModeConfig(preview.after);
    next.presetUndo[message.profileId] = { before: preview.before, after: preview.after };
  } else if (message.action === "presetUndo") {
    requireMode();
    const record = next.presetUndo[message.profileId];
    if (!record || configKey(modeConfig(next, message.profileId)) !== configKey(record.after)) {
      throw new Error(
        "This mode has changed since the preset was applied. Undo is no longer available.",
      );
    }
    setModeConfig(record.before);
    delete next.presetUndo[message.profileId];
  } else if (
    ["presetSave", "presetDuplicate", "presetUpdate", "presetRename", "presetDelete"].includes(
      message.action,
    )
  ) {
    const index = next.customPresets.findIndex((item) => item.id === message.presetId);
    if (["presetUpdate", "presetRename", "presetDelete"].includes(message.action) && index < 0) {
      throw new Error("Choose one of your saved presets. Built-in presets stay unchanged.");
    }
    let name;
    if (message.action !== "presetDelete") {
      name = presetName(message.name);
      const editingId = ["presetUpdate", "presetRename"].includes(message.action)
        ? message.presetId
        : null;
      if (
        next.customPresets.some(
          (item) => item.id !== editingId && item.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        throw new Error("You already have a preset with that name. Choose a different name.");
      }
    }
    if (message.action === "presetDelete") {
      next.customPresets.splice(index, 1);
    } else if (message.action === "presetRename") {
      next.customPresets[index].name = name;
    } else {
      if (["presetSave", "presetUpdate"].includes(message.action)) {
        requireMode();
      }
      const config =
        message.action === "presetDuplicate"
          ? resolvePreset(next, message.reference).config
          : modeConfig(next, message.profileId);
      if (message.action === "presetUpdate") {
        next.customPresets[index] = { id: message.presetId, name, config };
      } else {
        if (next.customPresets.length >= MAX_CUSTOM_PRESETS) {
          throw new Error(
            `You can save up to ${MAX_CUSTOM_PRESETS} presets. Delete one before saving another.`,
          );
        }
        next.customPresets.push({ id: `custom-${crypto.randomUUID()}`, name, config });
      }
    }
  } else if (["allowAdd", "allowRemove"].includes(message.action)) {
    requireMode();
    const domain = normalizeDomain(message.domain),
      list = next.allowedDomains[message.profileId];
    if (message.action === "allowAdd") {
      if (list.includes(domain)) {
        throw new Error("This website is already allowed in this mode.");
      }
      if (list.length >= MAX_DOMAINS) {
        throw new Error(`You can allow up to ${MAX_DOMAINS} websites in each mode.`);
      }
      list.push(domain);
    } else {
      next.allowedDomains[message.profileId] = list.filter((item) => item !== domain);
    }
  } else if (message.action === "instagram") {
    requireMode();
    next.instagram[message.profileId] = globalThis.FocusUpInstagram.normalize(message.config);
  } else if (message.action === "youtube") {
    requireMode();
    next.youtube[message.profileId] = globalThis.FocusUpYouTube.normalize(message.config);
  } else if (message.action === "mode") {
    if (!isProfileId(message.profileId)) {
      throw new Error("Unknown mode.");
    }
    next.activeProfileId = message.profileId;
  } else if (["add", "remove"].includes(message.action)) {
    requireMode();
    const domain = normalizeDomain(message.domain);
    const list = next.blockedDomains[message.profileId];
    if (message.action === "add") {
      if (list.includes(domain)) {
        throw new Error("This domain is already in this mode's list.");
      }
      if (list.length >= MAX_DOMAINS) {
        throw new Error(`Each mode supports up to ${MAX_DOMAINS} domains.`);
      }
      list.push(domain);
    } else {
      next.blockedDomains[message.profileId] = list.filter((item) => item !== domain);
    }
  } else if (message.action !== "get") {
    throw new Error("Unknown settings action.");
  }
  await syncRules(next);
  try {
    if (message.action !== "get") {
      await chrome.storage.local.set(next);
    }
  } catch (error) {
    await syncRules(previous);
    throw error;
  }
  return next;
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "focusup-settings" || sender.id !== chrome.runtime.id) {
    return;
  }
  enqueue(() => handleSettings(message)).then(
    (settings) => sendResponse({ ok: true, settings }),
    (error) => sendResponse({ ok: false, error: error.message }),
  );
  return true;
});
chrome.runtime.onInstalled.addListener(() => enqueue(async () => syncRules(await getSettings())));
chrome.runtime.onStartup.addListener(() => enqueue(async () => syncRules(await getSettings())));
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    (changes.activeProfileId || changes.blockedDomains || changes.allowedDomains)
  ) {
    enqueue(async () => syncRules(await getSettings()));
  }
});
enqueue(async () => syncRules(await getSettings()));
