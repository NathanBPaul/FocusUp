import { requestSettings } from "../src/storage/settings.js";
const labels = {
  hideHome: "Hide suggested videos on the homepage",
  hideRelated: "Hide suggested videos while watching",
  hideSidebar: "Hide distracting menu options",
  allowSearch: "Allow searching for videos",
  allowSubscriptions: "Allow viewing subscriptions",
  allowVideos: "Allow watching videos",
  strictChannels: "Only allow videos from channels I've approved",
};
const form = document.querySelector("#config"),
  profile = document.querySelector("#profile"),
  status = document.querySelector("#status");
const sections = {
  hideHome: [
    "Keep YouTube distraction-free",
    "Hide the parts of YouTube that make it easy to lose track of time.",
  ],
  allowSearch: ["Choose what you can do"],
  strictChannels: ["Choose which channels you can watch"],
};
let settings;
for (const [key, text] of Object.entries(labels)) {
  if (sections[key]) {
    const heading = document.createElement("h2");
    heading.textContent = sections[key][0];
    document.querySelector("#toggles").append(heading);
    if (sections[key][1]) {
      const description = document.createElement("p");
      description.textContent = sections[key][1];
      document.querySelector("#toggles").append(description);
    }
  }
  const label = document.createElement("label"),
    input = document.createElement("input");
  input.type = "checkbox";
  input.name = key;
  label.append(input, document.createTextNode(text));
  document.querySelector("#toggles").append(label);
  if (key === "strictChannels") {
    const description = document.createElement("p");
    description.textContent =
      "When enabled, videos from other channels will be blocked. Videos whose channels cannot be identified will stay blocked until an approved channel is recognized. These channel settings also apply to channel pages and video suggestions.";
    document.querySelector("#toggles").append(description);
  }
}
const modeName = (id) => (id === "focus" ? "Focus Mode" : "Personal Mode");
function explainExceptions() {
  const domains = settings.allowedDomains[profile.value].filter(
    (domain) => domain === "youtube.com" || domain.endsWith(".youtube.com"),
  );
  document.querySelector("#exception-note").hidden = domains.length === 0;
  document.querySelector("#exception-note").textContent =
    `Allowed website exceptions (${domains.join(", ")}) bypass YouTube controls on those addresses. Remove them in Presets & exceptions to apply these controls there.`;
}
function showModeExplanation() {
  const active = modeName(settings.activeProfileId),
    edited = modeName(profile.value);
  document.querySelector("#active").textContent =
    settings.activeProfileId === profile.value
      ? `You're currently using ${active}. Save your changes to apply them to this mode.`
      : `You're currently using ${active}. Once saved, these settings will apply when you switch to ${edited}.`;
}
function saveError(error) {
  if (/channel URL|@handle|display name/.test(error.message)) {
    return "Use a YouTube @handle, such as @Veritasium, or a channel ID link. Channel names alone won't work.";
  }
  if (/200 channels/.test(error.message)) {
    return "You can add up to 200 channels to each list. Remove a channel and try again.";
  }
  return "Your YouTube settings couldn't be saved. Please try again.";
}
function show() {
  const config = settings.youtube[profile.value];
  for (const [key, value] of Object.entries(config)) {
    if (Array.isArray(value)) {
      form.elements[key].value = value.join("\n");
    } else if (typeof value === "boolean") {
      form.elements[key].checked = value;
    } else {
      form.elements[key].value = value;
    }
  }
  showModeExplanation();
  explainExceptions();
}
async function load() {
  try {
    settings = await requestSettings();
    profile.value = settings.activeProfileId;
    show();
    form.querySelector("fieldset").disabled = false;
    status.textContent = `${modeName(profile.value)} settings loaded.`;
  } catch (error) {
    status.textContent =
      "Your YouTube settings couldn't be loaded. Please try restoring your saved settings.";
  }
}
profile.addEventListener("change", () => {
  if (settings) {
    show();
    status.textContent = `${modeName(profile.value)} settings loaded.`;
  }
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const config = {};
  for (const key of Object.keys(labels)) {
    config[key] = form.elements[key].checked;
  }
  config.shorts = form.elements.shorts.value;
  for (const key of ["allowedChannels", "blockedChannels"]) {
    config[key] = form.elements[key].value
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  form.querySelector("fieldset").disabled = true;
  profile.disabled = true;
  try {
    settings = await requestSettings("youtube", { profileId: profile.value, config });
    show();
    status.textContent = "Your YouTube settings have been saved.";
  } catch (error) {
    status.textContent = saveError(error);
  } finally {
    form.querySelector("fieldset").disabled = false;
    profile.disabled = false;
  }
});
document.querySelector("#reload").addEventListener("click", load);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.allowedDomains && settings) {
    settings.allowedDomains = changes.allowedDomains.newValue || { focus: [], personal: [] };
    explainExceptions();
  }
  if (area === "local" && changes.activeProfileId && settings) {
    settings.activeProfileId = changes.activeProfileId.newValue === "focus" ? "focus" : "personal";
    showModeExplanation();
  }
});
load();
