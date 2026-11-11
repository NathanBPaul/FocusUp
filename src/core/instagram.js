// Shared policy; the adapter supplies account identities from supported page layouts.
(() => {
  const reserved = new Set([
    "accounts",
    "about",
    "api",
    "challenge",
    "developer",
    "direct",
    "directory",
    "emails",
    "explore",
    "graphql",
    "legal",
    "notifications",
    "oauth",
    "p",
    "privacy",
    "push",
    "reel",
    "reels",
    "saved",
    "search",
    "settings",
    "share",
    "stories",
    "topics",
    "tv",
    "web",
    "your_activity",
  ]);
  const defaults = () => ({
    reels: "allow",
    reelLimit: 1,
    blockExplore: false,
    hideFeed: false,
    approvedOnly: false,
    allowedAccounts: [],
    blockedAccounts: [],
  });
  function account(value) {
    let name = String(value).trim();
    if (/^https?:\/\//i.test(name)) {
      const url = new URL(name);
      if (
        !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
        url.username ||
        url.password
      ) {
        throw new Error("Use an Instagram username or profile link.");
      }
      name = url.pathname.replace(/^\//, "").replace(/\/$/, "");
    }
    name = name.replace(/^@/, "").toLowerCase();
    if (
      !/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(name) ||
      name.includes("..") ||
      reserved.has(name)
    ) {
      throw new Error(
        "Use an Instagram username, such as @nasa, or a profile link. Display names won't work.",
      );
    }
    return name;
  }
  function normalize(raw = {}) {
    const next = defaults();
    for (const key of ["blockExplore", "hideFeed", "approvedOnly"]) {
      if (typeof raw[key] === "boolean") {
        next[key] = raw[key];
      }
    }
    if (["allow", "limit", "block"].includes(raw.reels)) {
      next.reels = raw.reels;
    }
    if (raw.reelLimit !== undefined) {
      if (!Number.isInteger(raw.reelLimit) || raw.reelLimit < 1 || raw.reelLimit > 20) {
        throw new Error("Choose a Reel limit between 1 and 20.");
      }
      next.reelLimit = raw.reelLimit;
    }
    for (const key of ["allowedAccounts", "blockedAccounts"]) {
      next[key] = [...new Set((Array.isArray(raw[key]) ? raw[key] : []).map(account))];
      if (next[key].length > 200) {
        throw new Error("You can add up to 200 accounts to each list.");
      }
    }
    return next;
  }
  function route(path) {
    if (/^\/direct(?:\/|$)/.test(path)) {
      return "messages";
    }
    if (/^\/reels?(?:\/|$)/.test(path)) {
      return "reels";
    }
    if (/^\/explore(?:\/|$)/.test(path)) {
      return "explore";
    }
    if (/^\/(p|tv)(?:\/|$)/.test(path)) {
      return "post";
    }
    if (path === "/") {
      return "home";
    }
    try {
      account(path.split("/")[1]);
      return path.split("/")[2] === "reels" ? "reels" : "profile";
    } catch {
      return "other";
    }
  }
  function accountReason(config, identities) {
    if (identities.some((id) => config.blockedAccounts.includes(id))) {
      return "This account is blocked";
    }
    if (config.approvedOnly && !identities.some((id) => config.allowedAccounts.includes(id))) {
      return identities.length
        ? "This account isn't in your allowed accounts"
        : "This account hasn't been identified yet. Only approved accounts can be viewed";
    }
    return "";
  }
  function reason(path, config, identities = []) {
    const type = route(path);
    // Messaging itself stays accessible. A Reel opened on a separate Reel page follows Reel settings.
    if (type === "messages") {
      return "";
    }
    if (type === "reels" && config.reels === "block") {
      return "Reels are blocked";
    }
    if (type === "explore" && config.blockExplore) {
      return "Explore is blocked";
    }
    if (["reels", "post", "profile"].includes(type)) {
      return accountReason(config, identities);
    }
    return "";
  }
  function visitTracker() {
    const seen = new Set();
    return {
      reset() {
        seen.clear();
      },
      allows(key, limit) {
        if (!key) {
          return false;
        }
        if (seen.has(key)) {
          return true;
        }
        if (seen.size >= limit) {
          return false;
        }
        seen.add(key);
        return true;
      },
    };
  }
  globalThis.FocusUpInstagram = Object.freeze({
    defaults,
    normalize,
    account,
    route,
    accountReason,
    reason,
    visitTracker,
  });
})();
