(() => {
  const api = globalThis.FocusUpInstagram;
  const visit = api.visitTracker();
  let config = api.defaults(), mode = "personal", loaded = false, queued = false, observing = false;
  let loadSequence = 0;
  const observer = new MutationObserver(schedule);

  function accountLinks(container) {
    // Only trust an article's creator header, never comments or suggested accounts.
    return [...new Set([...container.querySelectorAll("header a[href]")].flatMap(link => {
      try { return [api.account(link.href)]; } catch { return []; }
    }))];
  }
  function visibleArticle() {
    const articles = [...document.querySelectorAll('[role="dialog"] article, main article')];
    return articles.map(article => {
      const rect = article.getBoundingClientRect();
      const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
      return { article, height };
    }).filter(item => item.height > 0).sort((a, b) => b.height - a.height)[0]?.article;
  }
  function gate(reason) {
    if (!document.documentElement) return;
    let overlay = document.querySelector("#focusup-instagram-gate");
    document.documentElement.classList.toggle("focusup-instagram-gated", !!reason);
    if (!reason) { overlay?.remove(); return; }
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "focusup-instagram-gate";
      overlay.setAttribute("role", "region");
      overlay.setAttribute("aria-label", "Blocked by your FocusUp settings");
      const panel = document.createElement("section"), heading = document.createElement("h1");
      const text = document.createElement("p"), home = document.createElement("a");
      heading.textContent = "FocusUp · Instagram";
      text.id = "focusup-instagram-reason";
      home.href = "https://www.instagram.com/";
      home.textContent = "Go to Instagram Home";
      panel.append(heading, text, home); overlay.append(panel); document.documentElement.append(overlay);
    }
    const text = `${reason}. You're using ${mode === "focus" ? "Focus Mode" : "Personal Mode"}. To change this, open FocusUp and choose Manage Instagram.`;
    const target = overlay.querySelector("#focusup-instagram-reason");
    if (target.textContent !== text) target.textContent = text;
    document.querySelectorAll("video,audio").forEach(media => { if (!media.paused) media.pause(); });
  }
  function apply() {
    queued = false;
    if (!loaded || !document.documentElement) return;
    const path = location.pathname, type = api.route(path);
    if (type !== "reels") visit.reset();
    document.documentElement.classList.toggle("focusup-instagram-feed", config.hideFeed && type === "home");
    document.documentElement.classList.toggle("focusup-instagram-reels", config.reels === "block");
    const accountControls = config.approvedOnly || config.blockedAccounts.length > 0;
    const active = config.reels !== "allow" || config.blockExplore || config.hideFeed || accountControls;
    if (active && !observing) { observer.observe(document, { childList: true, subtree: true }); observing = true; }
    else if (!active && observing) { observer.disconnect(); observing = false; }
    // Never scan or hide messaging content, even when other restrictions are enabled.
    if (type === "messages") {
      document.querySelectorAll(".focusup-instagram-account-hidden").forEach(item => item.classList.remove("focusup-instagram-account-hidden"));
      gate(""); return;
    }
    let identities = [];
    if (type === "profile" || (type === "reels" && path.split("/")[2] === "reels")) {
      try { identities = [api.account(path.split("/")[1])]; } catch { /* Unknown profile. */ }
    }
    const article = accountControls || (type === "reels" && config.reels === "limit") ? visibleArticle() : null;
    if (article && type !== "profile") {
      // A permalink must agree with the current route to avoid trusting a previous SPA page's creator.
      const link = [...article.querySelectorAll('a[href]')].find(link => {
        try { return new URL(link.href).pathname.replace(/\/$/, "") === path.replace(/\/$/, ""); } catch { return false; }
      });
      if (link) identities = accountLinks(article);
    }
    if (accountControls && ["home", "explore", "profile"].includes(type)) {
      document.querySelectorAll("main article").forEach(item => {
        item.classList.toggle("focusup-instagram-account-hidden", !!api.accountReason(config, accountLinks(item)));
      });
    } else document.querySelectorAll(".focusup-instagram-account-hidden").forEach(item => item.classList.remove("focusup-instagram-account-hidden"));
    let reason = api.reason(path, config, identities);
    if (!reason && type === "reels" && config.reels === "limit") {
      const candidate = path.match(/^\/reels?\/([\w-]+)\/?$/)?.[1];
      const key = candidate && !["audio", "create"].includes(candidate) ? candidate : null;
      if (!key) reason = "This Reel can't be identified. Open an individual Reel to use your viewing limit";
      else if (!visit.allows(key, config.reelLimit)) reason = `You've reached your limit of ${config.reelLimit} ${config.reelLimit === 1 ? "Reel" : "Reels"} for this visit`;
    }
    gate(reason);
  }
  function schedule() {
    if (queued) return;
    queued = true; setTimeout(apply, 120);
  }
  async function load() {
    const sequence = ++loadSequence;
    try {
      const stored = await chrome.storage.local.get(["activeProfileId", "instagram"]);
      if (sequence !== loadSequence) return;
      const nextMode = stored.activeProfileId === "focus" ? "focus" : "personal";
      const next = api.normalize(stored.instagram?.[nextMode]);
      if (nextMode !== mode || next.reels !== config.reels || next.reelLimit !== config.reelLimit) visit.reset();
      mode = nextMode; config = next; loaded = true; schedule();
    } catch { gate("Your Instagram settings couldn't be loaded. Please reload this tab"); }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.activeProfileId || changes.instagram)) load();
  });
  document.addEventListener("play", event => {
    if (document.querySelector("#focusup-instagram-gate")) event.target.pause?.();
  }, true);
  window.addEventListener("popstate", schedule);
  // Route fallback for Instagram's client-side navigation; DOM work is coalesced separately.
  setInterval(schedule, 750);
  load();
})();
