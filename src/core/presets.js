import { normalizeDomain, MAX_DOMAINS } from "./rules.js";
import "./youtube.js";
import "./instagram.js";

export const MAX_CUSTOM_PRESETS = 20;
export const INTENSITIES = Object.freeze(["relaxed", "focused", "strict"]);
export const CATEGORIES = Object.freeze(
  [
    { id: "school", name: "School", description: "Make room for homework and school exams." },
    { id: "college", name: "College", description: "Stay with your courses and assignments." },
    {
      id: "entrance",
      name: "Entrance Exams",
      description: "Set aside time for entrance-exam preparation.",
    },
    {
      id: "competitive",
      name: "Competitive Exams",
      description: "Keep distractions away during exam preparation.",
    },
    {
      id: "work",
      name: "Professional Work",
      description: "Keep your attention on the task at hand.",
    },
    {
      id: "reading",
      name: "Reading & Learning",
      description: "Give yourself space to read and learn.",
    },
    { id: "reset", name: "Habit Reset", description: "Reduce feeds and short-video scrolling." },
  ].map(Object.freeze),
);

export function domainList(values = []) {
  if (!Array.isArray(values) || values.length > MAX_DOMAINS) {
    throw new Error(`Use up to ${MAX_DOMAINS} websites in each list.`);
  }
  return [...new Set(values.map(normalizeDomain))];
}
export function normalizeConfig(raw = {}) {
  return {
    blockedDomains: domainList(raw.blockedDomains),
    allowedDomains: domainList(raw.allowedDomains),
    youtube: globalThis.FocusUpYouTube.normalize(raw.youtube),
    instagram: globalThis.FocusUpInstagram.normalize(raw.instagram),
  };
}
export function modeConfig(settings, profileId) {
  return normalizeConfig({
    blockedDomains: settings.blockedDomains[profileId],
    allowedDomains: settings.allowedDomains[profileId],
    youtube: settings.youtube[profileId],
    instagram: settings.instagram[profileId],
  });
}
export function officialPreset(category, intensity) {
  const entry = CATEGORIES.find((item) => item.id === category);
  if (!entry || !INTENSITIES.includes(intensity)) {
    throw new Error("Choose a preset and its level.");
  }
  const config = normalizeConfig();
  const focused = intensity !== "relaxed",
    strict = intensity === "strict";
  config.youtube = {
    ...config.youtube,
    shorts: "block",
    hideRelated: focused,
    hideHome: focused,
    hideSidebar: focused,
  };
  config.instagram = {
    ...config.instagram,
    reels: "block",
    blockExplore: focused,
    hideFeed: focused,
  };
  // These are editable suggestions, not automatic classifications of websites or channels.
  config.blockedDomains = focused ? ["tiktok.com", "reddit.com", "x.com"] : ["tiktok.com"];
  if (strict) {
    config.blockedDomains.push("facebook.com", "twitch.tv", "netflix.com");
    config.youtube.strictChannels = true;
    config.instagram.approvedOnly = true;
  }
  if (["school", "entrance", "competitive"].includes(category) && focused) {
    config.blockedDomains.push("poki.com", "crazygames.com");
  }
  if (["entrance", "competitive"].includes(category) && focused) {
    config.youtube.allowSubscriptions = false;
  }
  if (category === "competitive" && focused && !config.blockedDomains.includes("facebook.com")) {
    config.blockedDomains.push("facebook.com");
  }
  if (category === "work" && focused) {
    config.blockedDomains.push("store.steampowered.com");
  }
  if (category === "reading" && focused) {
    config.youtube.allowSubscriptions = false;
    config.youtube.allowVideos = false;
  }
  if (category === "reset") {
    config.instagram.blockExplore = true;
    config.instagram.hideFeed = true;
    config.youtube.hideHome = true;
  }
  return {
    id: `official:${category}:${intensity}`,
    name: `${entry.name} · ${intensity[0].toUpperCase() + intensity.slice(1)}`,
    config,
  };
}
export function presetName(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 60) {
    throw new Error("Give your preset a name between 1 and 60 characters.");
  }
  return value.trim();
}
export function resolvePreset(settings, reference) {
  if (reference?.type === "official") {
    return officialPreset(reference.category, reference.intensity);
  }
  const saved = settings.customPresets.find((item) => item.id === reference?.id);
  if (!saved) {
    throw new Error("This saved preset is no longer available. Reload your settings.");
  }
  return structuredClone(saved);
}
export function applicationConfig(current, preset) {
  const next = normalizeConfig(preset.config);
  // Explicit exceptions have higher priority than preset defaults and survive preset changes.
  next.allowedDomains = domainList([
    ...new Set([...current.allowedDomains, ...next.allowedDomains]),
  ]);
  return next;
}
export const configKey = (config) => JSON.stringify(normalizeConfig(config));
export function previewPreset(settings, profileId, reference) {
  const preset = resolvePreset(settings, reference);
  const before = modeConfig(settings, profileId);
  const after = applicationConfig(before, preset);
  return {
    name: preset.name,
    before,
    after,
    key: JSON.stringify({ reference, name: preset.name, before, after }),
  };
}
