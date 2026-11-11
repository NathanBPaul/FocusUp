import { requestSettings } from "../src/storage/settings.js";
import { CATEGORIES, modeConfig, configKey } from "../src/core/presets.js";
const $ = (id) => document.getElementById(id);
const modeName = (id) => (id === "focus" ? "Focus Mode" : "Personal Mode");
let settings,
  preview,
  busy = false,
  deleteId = null;

function reference() {
  const value = $("preset").value;
  return value.startsWith("official:")
    ? { type: "official", category: value.slice(9), intensity: $("intensity").value }
    : { type: "custom", id: value };
}
function invalidate() {
  preview = null;
  $("preview-panel").hidden = true;
}
function controls() {
  document
    .querySelectorAll("input,select,button")
    .forEach((item) => (item.disabled = busy || !settings));
  if (busy || !settings) {
    $("reload").disabled = busy;
    return;
  }
  const custom = reference().type === "custom";
  $("intensity").disabled = custom;
  for (const id of ["update", "rename", "delete"]) {
    $(id).disabled = !custom;
  }
  const record = settings.presetUndo[$("profile").value];
  const canUndo =
    record && configKey(modeConfig(settings, $("profile").value)) === configKey(record.after);
  $("undo").disabled = !canUndo;
  $("undo-note").textContent = canUndo
    ? "Undo restores this mode's settings from just before the last preset was applied."
    : "Undo is available after applying a preset, until this mode's settings change.";
}
function describe() {
  const ref = reference(),
    category = CATEGORIES.find((item) => item.id === ref.category);
  $("description").textContent =
    category?.description || "Your saved setup. Applying it doesn't change the saved preset.";
  $("level-description").textContent =
    ref.type === "custom"
      ? "This preset uses the settings you saved, without an additional level."
      : {
          relaxed:
            "Relaxed removes short-video distractions while leaving most browsing available.",
          focused:
            "Focused hides more recommendations and feeds, with a suggested list of blocked websites.",
          strict:
            "Strict also blocks more websites and limits videos and posts to accounts you've approved. Add approved channels and accounts before using them.",
        }[ref.intensity];
}
function render() {
  const selected = $("preset").value;
  $("preset").replaceChildren();
  for (const [name, items] of [
    [
      "Built-in presets",
      CATEGORIES.map((item) => ({ value: `official:${item.id}`, name: item.name })),
    ],
    ["My presets", settings.customPresets.map((item) => ({ value: item.id, name: item.name }))],
  ]) {
    if (!items.length) {
      continue;
    }
    const group = document.createElement("optgroup");
    group.label = name;
    for (const item of items) {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.name;
      group.append(option);
    }
    $("preset").append(group);
  }
  if ([...$("preset").options].some((option) => option.value === selected)) {
    $("preset").value = selected;
  }
  const mode = $("profile").value;
  $("active").textContent =
    settings.activeProfileId === mode
      ? `You're using ${modeName(mode)}. Changes applied here take effect in this mode.`
      : `You're using ${modeName(settings.activeProfileId)}. These settings will apply when you switch to ${modeName(mode)}.`;
  $("allowed-list").replaceChildren();
  for (const domain of settings.allowedDomains[mode]) {
    const item = document.createElement("li"),
      text = document.createElement("span"),
      remove = document.createElement("button");
    text.textContent = domain;
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove exception for ${domain}`);
    remove.addEventListener("click", () =>
      change(
        "allowRemove",
        { profileId: mode, domain },
        "Website exception removed. This mode's restrictions apply again.",
      ),
    );
    item.append(text, remove);
    $("allowed-list").append(item);
  }
  $("allowed-empty").hidden = settings.allowedDomains[mode].length > 0;
  describe();
  controls();
}
function rows(config) {
  const list = (values) => (values.length ? values.join(", ") : "None");
  const yes = (value) => (value ? "Allowed" : "Blocked");
  const hidden = (value) => (value ? "Hidden" : "Visible");
  const yt = config.youtube,
    ig = config.instagram;
  return [
    ["Blocked websites", list(config.blockedDomains)],
    ["Allowed websites", list(config.allowedDomains)],
    [
      "YouTube Shorts",
      { allow: "Allow all", first: "Block after the first Short", block: "Block all" }[yt.shorts],
    ],
    ["YouTube homepage suggestions", hidden(yt.hideHome)],
    ["Suggestions while watching", hidden(yt.hideRelated)],
    ["YouTube menu distractions", hidden(yt.hideSidebar)],
    ["YouTube search", yes(yt.allowSearch)],
    ["YouTube subscriptions", yes(yt.allowSubscriptions)],
    ["Watching videos", yes(yt.allowVideos)],
    ["Approved channels only", yt.strictChannels ? "On" : "Off"],
    ["Allowed channels", list(yt.allowedChannels)],
    ["Blocked channels", list(yt.blockedChannels)],
    [
      "Instagram Reels",
      ig.reels === "limit"
        ? `Up to ${ig.reelLimit} per visit`
        : ig.reels === "block"
          ? "Block all"
          : "Allow all",
    ],
    ["Instagram Explore", yes(!ig.blockExplore)],
    ["Instagram homepage feed", hidden(ig.hideFeed)],
    ["Approved accounts only", ig.approvedOnly ? "On" : "Off"],
    ["Allowed accounts", list(ig.allowedAccounts)],
    ["Blocked accounts", list(ig.blockedAccounts)],
  ];
}
function showPreview() {
  $("preview-title").textContent = `Review changes for ${modeName($("profile").value)}`;
  $("preview-intro").textContent =
    `“${preview.name}” will replace this mode's blocked websites and content settings. Existing allowed websites stay allowed. The other mode won't change. Save your current setup as a preset first if you want to keep a copy.`;
  const warnings = [];
  if (preview.after.youtube.strictChannels && !preview.after.youtube.allowedChannels.length) {
    warnings.push(
      "No YouTube channels are approved yet. Add channels in Manage YouTube before watching videos, unless YouTube is an allowed website.",
    );
  }
  if (preview.after.instagram.approvedOnly && !preview.after.instagram.allowedAccounts.length) {
    warnings.push(
      "No Instagram accounts are approved yet. Add accounts in Manage Instagram before viewing posts, unless Instagram is an allowed website.",
    );
  }
  $("warnings").textContent = warnings.join(" ");
  $("comparison").replaceChildren();
  const before = rows(preview.before),
    after = rows(preview.after);
  for (let i = 0; i < before.length; i++) {
    const row = document.createElement("tr");
    row.classList.toggle("changed", before[i][1] !== after[i][1]);
    for (const value of [before[i][0], before[i][1], after[i][1]]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    $("comparison").append(row);
  }
  $("apply").textContent = `Apply to ${modeName($("profile").value)}`;
  $("preview-panel").hidden = false;
  $("preview-panel").scrollIntoView({ block: "start" });
}
async function change(action, values = {}, success = "Settings updated.") {
  if (busy) {
    return;
  }
  busy = true;
  controls();
  try {
    settings = await requestSettings(action, values);
    if (action === "presetPreview") {
      preview = settings.presetPreview;
      showPreview();
    } else {
      invalidate();
      $("delete-panel").hidden = true;
      render();
    }
    $("status").textContent = success;
    return true;
  } catch (error) {
    if (action === "presetApply") {
      invalidate();
    }
    const message = error.message || "";
    $("status").textContent = /domain/.test(message)
      ? "Enter a website address, such as example.com, or paste a link."
      : /^(Choose |Give your preset|You already have|You can |Use up to|This saved preset|This mode has changed|Your settings or preset|This website is already)/.test(
            message,
          )
        ? message
        : "Your settings couldn't be loaded or updated. Please reload your settings and try again.";
    return false;
  } finally {
    busy = false;
    controls();
  }
}
async function load(initial = false) {
  if (busy) {
    return;
  }
  busy = true;
  controls();
  try {
    settings = await requestSettings();
    if (initial) {
      $("profile").value = settings.activeProfileId;
    }
    invalidate();
    render();
    $("status").textContent = "Your presets and settings are loaded.";
  } catch {
    $("status").textContent = "Your settings couldn't be loaded. Please try reloading them.";
  } finally {
    busy = false;
    controls();
  }
}
for (const id of ["profile", "preset", "intensity"]) {
  $(id).addEventListener("change", () => {
    invalidate();
    $("delete-panel").hidden = true;
    if (id === "preset") {
      $("preset-name").value =
        settings.customPresets.find((item) => item.id === $("preset").value)?.name || "";
    }
    render();
    $("status").textContent = "Choose Preview changes to review this setup.";
  });
}
$("preview").addEventListener("click", () =>
  change(
    "presetPreview",
    { profileId: $("profile").value, reference: reference() },
    "Preview ready. Your settings haven't changed.",
  ),
);
$("apply").addEventListener("click", () => {
  if (preview) {
    change(
      "presetApply",
      { profileId: $("profile").value, reference: reference(), previewKey: preview.key },
      `Preset applied to ${modeName($("profile").value)}. You can customize its settings at any time.`,
    );
  }
});
$("cancel-preview").addEventListener("click", () => {
  invalidate();
  $("status").textContent = "Preview closed. Your settings haven't changed.";
});
$("undo").addEventListener("click", () =>
  change(
    "presetUndo",
    { profileId: $("profile").value },
    "Your mode settings from before the last preset have been restored.",
  ),
);
function libraryAction(action) {
  return change(
    action,
    {
      profileId: $("profile").value,
      presetId: $("preset").value,
      reference: reference(),
      name: $("preset-name").value,
    },
    "Your saved presets have been updated.",
  );
}
$("save-current").addEventListener("click", () => libraryAction("presetSave"));
$("duplicate").addEventListener("click", () => libraryAction("presetDuplicate"));
$("update").addEventListener("click", () => libraryAction("presetUpdate"));
$("rename").addEventListener("click", () => libraryAction("presetRename"));
$("delete").addEventListener("click", () => {
  const item = settings.customPresets.find((item) => item.id === $("preset").value);
  if (!item) {
    return;
  }
  deleteId = item.id;
  $("delete-question").textContent =
    `Delete “${item.name}”? Your current mode settings won't change.`;
  $("delete-panel").hidden = false;
});
$("confirm-delete").addEventListener("click", () =>
  change(
    "presetDelete",
    { presetId: deleteId },
    "Saved preset deleted. Your mode settings haven't changed.",
  ),
);
$("cancel-delete").addEventListener("click", () => {
  $("delete-panel").hidden = true;
});
$("allow-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    await change(
      "allowAdd",
      { profileId: $("profile").value, domain: $("allowed-domain").value },
      "Website exception saved. FocusUp will allow this website in this mode.",
    )
  ) {
    $("allowed-domain").value = "";
  }
});
$("reload").addEventListener("click", () => load());
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    !busy &&
    Object.keys(changes).some((key) =>
      [
        "activeProfileId",
        "blockedDomains",
        "allowedDomains",
        "youtube",
        "instagram",
        "customPresets",
        "presetUndo",
      ].includes(key),
    )
  ) {
    load();
  }
});
load(true);
