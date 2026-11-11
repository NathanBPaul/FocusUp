import { requestSettings } from "../src/storage/settings.js";

const form = document.querySelector("#config");
const profile = document.querySelector("#profile");
const status = document.querySelector("#status");
const fieldset = form.querySelector("fieldset");
const reload = document.querySelector("#reload");
const modeName = (id) => (id === "focus" ? "Focus Mode" : "Personal Mode");
let settings;
let busy = false;

function explainMode() {
  const active = modeName(settings.activeProfileId);
  document.querySelector("#active").textContent =
    settings.activeProfileId === profile.value
      ? `You're currently using ${active}. Save your changes to apply them to this mode.`
      : `You're currently using ${active}. Once saved, these settings will apply when you switch to ${modeName(profile.value)}.`;
}
function explainExceptions() {
  const domains = settings.allowedDomains[profile.value].filter(
    (domain) => domain === "instagram.com" || domain.endsWith(".instagram.com"),
  );
  document.querySelector("#exception-note").hidden = domains.length === 0;
  document.querySelector("#exception-note").textContent =
    `Allowed website exceptions (${domains.join(", ")}) bypass Instagram controls on those addresses. Remove them in Presets & exceptions to apply these controls there.`;
}
function show() {
  for (const [key, value] of Object.entries(settings.instagram[profile.value])) {
    if (Array.isArray(value)) {
      form.elements[key].value = value.map((name) => `@${name}`).join("\n");
    } else if (typeof value === "boolean") {
      form.elements[key].checked = value;
    } else {
      form.elements[key].value = value;
    }
  }
  explainMode();
  explainExceptions();
}
function setBusy(value) {
  busy = value;
  fieldset.disabled = value || !settings;
  profile.disabled = value || !settings;
  reload.disabled = value;
}
async function load() {
  if (busy) {
    return;
  }
  setBusy(true);
  try {
    settings = await requestSettings();
    profile.value = settings.activeProfileId;
    show();
    status.textContent = `${modeName(profile.value)} settings loaded.`;
  } catch {
    status.textContent =
      "Your Instagram settings couldn't be loaded. Please try restoring your saved settings.";
  } finally {
    setBusy(false);
  }
}
profile.addEventListener("change", () => {
  if (!settings || busy) {
    return;
  }
  show();
  status.textContent = `${modeName(profile.value)} settings loaded.`;
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!settings || busy) {
    return;
  }
  const config = {
    reels: form.elements.reels.value,
    reelLimit: Number(form.elements.reelLimit.value),
  };
  for (const key of ["blockExplore", "hideFeed", "approvedOnly"]) {
    config[key] = form.elements[key].checked;
  }
  for (const key of ["allowedAccounts", "blockedAccounts"]) {
    config[key] = form.elements[key].value
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
  }
  setBusy(true);
  try {
    settings = await requestSettings("instagram", { profileId: profile.value, config });
    show();
    status.textContent =
      "Your Instagram settings have been saved. Open Instagram tabs will update automatically.";
  } catch (error) {
    status.textContent = /username|profile link|Display names|Reel limit|200 accounts/.test(
      error.message,
    )
      ? error.message
      : "Your Instagram settings couldn't be saved. Please try again.";
  } finally {
    setBusy(false);
  }
});
reload.addEventListener("click", load);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.allowedDomains && settings) {
    settings.allowedDomains = changes.allowedDomains.newValue || { focus: [], personal: [] };
    explainExceptions();
  }
  if (area === "local" && changes.activeProfileId && settings) {
    settings.activeProfileId = changes.activeProfileId.newValue === "focus" ? "focus" : "personal";
    explainMode();
  }
});
load();
