(() => {
  const api = globalThis.FocusUpYouTube;
  let config = api.defaults(), mode = "personal", loaded = false, queued = false;
  let route = "", firstShort = "", lastVideo = "", ready = false;
  const classes = {hideHome:"focusup-home",hideRelated:"focusup-related",hideSidebar:"focusup-sidebar"};
  function identities() {
    const channelPath = location.pathname.match(/^\/(?:@[^/]+|channel\/[^/]+)/)?.[0];
    if (channelPath) {try {return [api.channel(channelPath)];} catch {return [];}}
    const watch = document.querySelector("ytd-watch-flexy");
    if (location.pathname === "/watch" && watch && watch.getAttribute("video-id") !== new URLSearchParams(location.search).get("v")) return [];
    const links = document.querySelectorAll('ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a, ytd-reel-video-renderer[is-active] ytd-channel-name a, ytd-reel-video-renderer[is-active] a[href^="/@"]');
    return [...new Set([...links].flatMap(link=>{try{return [api.channel(link.href)];}catch{return [];}}))];
  }
  function gate(reason) {
    let overlay = document.getElementById("focusup-gate");
    document.documentElement.classList.toggle("focusup-gated",!!reason);
    if (!reason) {overlay?.remove();return;}
    if (!overlay) {
      overlay = document.createElement("div"); overlay.id = "focusup-gate";
      overlay.setAttribute("role","region");overlay.setAttribute("aria-label","FocusUp restriction");
      const panel = document.createElement("section"), title = document.createElement("h1"), text = document.createElement("p"), link = document.createElement("a");
      title.textContent = "FocusUp · YouTube";
      text.id = "focusup-reason"; link.href = "https://www.youtube.com/"; link.textContent = "Return to YouTube Home";
      panel.append(title,text,link);overlay.append(panel);document.documentElement.append(overlay);
    }
    const text = reason + " in " + mode + " mode. Change your YouTube controls through the FocusUp popup.";
    if (overlay.querySelector("#focusup-reason").textContent !== text) overlay.querySelector("#focusup-reason").textContent = text;
    document.querySelectorAll("video,audio").forEach(media=>{if(!media.paused) media.pause();});
  }
  function apply() {
    queued = false;
    if (!loaded || !document.documentElement) return;
    const key = location.pathname + location.search;
    if (key !== route) {
      route = key;
      if (key !== lastVideo) ready = false;
      lastVideo = key;
    }
    for(const [key,cls] of Object.entries(classes)) document.documentElement.classList.toggle(cls,config[key]);
    document.querySelectorAll("ytd-video-renderer,ytd-grid-video-renderer,ytd-rich-item-renderer,ytd-compact-video-renderer").forEach(card => {
      const ids = [...card.querySelectorAll('ytd-channel-name a')].flatMap(link=>{try{return [api.channel(link.href)];}catch{return [];}});
      const blocked = ids.some(id=>config.blockedChannels.includes(id)) ||
        (config.strictChannels && !ids.some(id=>config.allowedChannels.includes(id)));
      card.classList.toggle("focusup-channel-hidden",blocked);
    });
    document.documentElement.classList.toggle("focusup-shorts",config.shorts === "block");
    if (!location.pathname.startsWith("/shorts/")) firstShort = "";
    else if (config.shorts === "first" && !firstShort) firstShort = location.pathname;
    // Wait for SPA navigation completion before trusting creator links from the previous video.
    const ids = ready || !document.querySelector("ytd-app") ? identities() : [];
    let reason = api.reason(location.pathname,config,ids);
    if(config.shorts === "first" && firstShort && location.pathname.startsWith("/shorts/") && firstShort !== location.pathname)
      reason = "Only the first Short is allowed";
    gate(reason);
  }
  function schedule() {
    if (queued) return;
    queued = true;setTimeout(apply,100);
  }
  async function load() {
    try {
      const stored = await chrome.storage.local.get(["activeProfileId","youtube"]);
      const nextMode = stored.activeProfileId === "focus" ? "focus" : "personal";
      if (mode !== nextMode) firstShort = "";
      mode = nextMode;config = api.normalize(stored.youtube?.[mode]);loaded = true;schedule();
    } catch { gate("Unable to load YouTube controls. Reload this tab"); }
  }
  document.addEventListener("yt-navigate-start",()=>{ready=false;schedule();});
  document.addEventListener("yt-navigate-finish",()=>{ready=true;lastVideo=location.pathname+location.search;route=lastVideo;schedule();});
  document.addEventListener("play",()=>{if(document.getElementById("focusup-gate")) document.querySelectorAll("video,audio").forEach(m=>m.pause());},true);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local"&&(changes.activeProfileId||changes.youtube)) load();});
  new MutationObserver(schedule).observe(document,{childList:true,subtree:true});
  setInterval(schedule,500);
  window.addEventListener("popstate",schedule);
  // Initial full navigation already belongs to this document.
  ready = true;route=location.pathname+location.search;lastVideo=route;
  load();
})();

