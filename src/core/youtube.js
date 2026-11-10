// Shared by the isolated content adapter, settings UI, and rules service.
(() => {
  const defaults = () => ({ shorts: "allow", hideHome: false, hideRelated: false, hideSidebar: false,
    allowSearch: true, allowSubscriptions: true, allowVideos: true, strictChannels: false, allowedChannels: [], blockedChannels: [] });
  function channel(value) {
    const text = String(value).trim();
    let path = text;
    if (/^https?:/i.test(text)) {
      const url = new URL(text);
      if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) throw new Error("Use a YouTube channel URL.");
      path = url.pathname;
    }
    path = path.replace(/^\//, "").replace(/\/$/, "");
    if (/^channel\/UC[\w-]{22}$/.test(path)) return path.slice(8);
    if (/^UC[\w-]{22}$/.test(path)) return path;
    if (/^@[\p{L}\p{N}_.-]{3,30}$/u.test(path)) return path.toLowerCase();
    throw new Error("Use an @handle or a /channel/UC… URL (not a display name).");
  }
  function normalize(raw = {}) {
    const next = defaults();
    for (const key of Object.keys(next)) {
      if (typeof next[key] === "boolean") next[key] = typeof raw[key] === "boolean" ? raw[key] : next[key];
    }
    if (["allow", "first", "block"].includes(raw.shorts)) next.shorts = raw.shorts;
    for (const key of ["allowedChannels", "blockedChannels"]) {
      next[key] = [...new Set((Array.isArray(raw[key]) ? raw[key] : []).map(channel))];
      if (next[key].length > 200) throw new Error("Use at most 200 channels per list.");
    }
    return next;
  }
  function reason(path, config, identities = []) {
    if (/^\/shorts(?:\/|$)/.test(path) && config.shorts === "block") return "Shorts are blocked";
    if (path === "/results" && !config.allowSearch) return "Search is blocked";
    if (/^\/feed\/subscriptions\/?$/.test(path) && !config.allowSubscriptions) return "Subscriptions are blocked";
    const video = /^\/(watch|shorts|embed|live)(?:\/|$)/.test(path);
    const channelPage = /^\/(?:@[^/]+|channel\/[^/]+)(?:\/|$)/.test(path);
    if (video || channelPage) {
      if (video && !config.allowVideos) return "Watching videos is blocked";
      if (identities.some(id => config.blockedChannels.includes(id))) return "This channel is blocked";
      if (config.strictChannels && !identities.some(id => config.allowedChannels.includes(id)))
        return identities.length ? "This channel isn't in your allowed channels" : "This channel hasn't been identified yet. Only approved channels can be watched";
    }
    return "";
  }
  globalThis.FocusUpYouTube = Object.freeze({ defaults, normalize, channel, reason });
})();
