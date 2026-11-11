import assert from "node:assert/strict";

export async function testInstagram({ call, evaluate, settings, delay, extension, setEventHandler, live = false }) {
  const fixture = '<!doctype html><html><body><nav><a href="/direct/inbox/">Messages</a></nav><main><article><header><a href="/nasa/">NASA</a></header><a class="permalink" href="/p/one/">Post</a><video></video><p>Post content</p></article></main></body></html>';
  const { targetId } = await call("Target.createTarget", {url:"about:blank"});
  const { sessionId: page } = await call("Target.attachToTarget", {targetId,flatten:true});
  setEventHandler(message => {
    if (message.method === "Fetch.requestPaused") call("Fetch.fulfillRequest", {
      requestId:message.params.requestId, responseCode:200,
      responseHeaders:[{name:"Content-Type",value:"text/html"}], body:Buffer.from(fixture).toString("base64")
    }, message.sessionId).catch(console.error);
  });
  await call("Fetch.enable", {patterns:[{urlPattern:"https://www.instagram.com/*",resourceType:"Document",requestStage:"Request"}]}, page);
  await settings("mode", {profileId:"focus"});
  await call("Page.navigate", {url:"https://www.instagram.com/p/one/"}, page);
  await delay(1000);
  const reason = () => evaluate(page, "document.querySelector('#focusup-instagram-reason')?.textContent || ''");
  async function configure(config) {
    await settings("instagram", {profileId:"focus",config});
    await delay(1000);
  }
  async function route(path) {
    await evaluate(page, `history.pushState({},'',${JSON.stringify(path)});document.querySelector('.permalink').href=${JSON.stringify(path)}`);
    await delay(1000);
  }
  await configure({approvedOnly:true,allowedAccounts:["@nasa"]});
  assert.equal(await reason(), "");
  await configure({approvedOnly:true,allowedAccounts:["@other"]});
  assert.match(await reason(), /allowed accounts/);
  await configure({blockedAccounts:["@nasa"]});
  assert.match(await reason(), /account is blocked/);
  await settings("mode", {profileId:"personal"}); await delay(1000);
  assert.equal(await reason(), "");
  await settings("mode", {profileId:"focus"}); await delay(1000);
  assert.match(await reason(), /account is blocked/);
  await configure({approvedOnly:true});
  await evaluate(page, "document.querySelector('header').remove()"); await delay(300);
  assert.match(await reason(), /identified/);
  await evaluate(page, "const h=document.createElement('header');h.innerHTML='<a href=\"/nasa/\">NASA</a>';document.querySelector('article').prepend(h)");
  await configure({blockExplore:true});
  await route("/explore/"); assert.match(await reason(), /Explore/);
  await call("Page.reload", {}, page); await delay(1000);
  assert.match(await reason(), /Explore/);
  await configure({reels:"block"});
  await route("/reel/one/"); assert.match(await reason(), /Reels are blocked/);
  assert.equal(await evaluate(page,"getComputedStyle(document.querySelector('.permalink')).display"), "none");
  await route("/nasa/reels/"); assert.match(await reason(), /Reels are blocked/);
  await route("/reel/one/");
  await configure({reels:"limit",reelLimit:1});
  assert.equal(await reason(), "");
  await route("/reels/two/"); assert.match(await reason(), /limit of 1 Reel/);
  await route("/direct/inbox/"); assert.equal(await reason(), "");
  assert.notEqual(await evaluate(page,"getComputedStyle(document.querySelector('main')).display"), "none");
  await route("/reel/two/"); assert.equal(await reason(), "");
  await configure({reels:"limit",reelLimit:2});
  await route("/reel/three/"); assert.equal(await reason(), "");
  await route("/reel/four/"); assert.match(await reason(), /limit of 2 Reels/);
  await route("/reels/"); assert.match(await reason(), /can't be identified/);
  await configure({reels:"allow"}); assert.equal(await reason(), "");
  assert.notEqual(await evaluate(page,"getComputedStyle(document.querySelector('.permalink')).display"), "none");
  await configure({hideFeed:true});
  await route("/");
  assert.equal(await evaluate(page,"getComputedStyle(document.querySelector('main')).display"), "none");
  assert.notEqual(await evaluate(page,"getComputedStyle(document.querySelector('nav')).display"), "none");
  await route("/direct/t/thread/");
  assert.notEqual(await evaluate(page,"getComputedStyle(document.querySelector('main')).display"), "none");
  await configure({reels:"block",blockExplore:true,hideFeed:true,approvedOnly:true,blockedAccounts:["@nasa"]});
  assert.equal(await reason(), ""); // Messaging stays accessible under all restrictions.
  await route("/nasa/"); assert.match(await reason(), /account is blocked/);
  await route("/direct/inbox/"); assert.equal(await reason(), "");
  assert.notEqual(await evaluate(page,"getComputedStyle(document.querySelector('article')).display"), "none");
  await configure({}); assert.equal(await reason(), "");
  await route("/");
  assert.notEqual(await evaluate(page,"getComputedStyle(document.querySelector('main')).display"), "none");
  // Settings UI: per-mode save, validation, restore, and unchanged YouTube settings.
  const before = await settings("get");
  const {targetId: settingsId} = await call("Target.createTarget", {url:extension+"/settings/instagram.html"});
  const {sessionId: ui} = await call("Target.attachToTarget", {targetId:settingsId,flatten:true});
  await delay(700);
  assert.equal(await evaluate(ui,"document.querySelector('h1').textContent"), "Manage Instagram");
  await evaluate(ui,"document.querySelector('[name=blockExplore]').checked=true;document.querySelector('#config').requestSubmit()");
  await delay(700);
  assert.match(await evaluate(ui,"document.querySelector('#status').textContent"), /have been saved/);
  assert.equal((await settings("get")).instagram.focus.blockExplore, true);
  assert.equal((await settings("get")).instagram.personal.blockExplore, false);
  assert.deepEqual((await settings("get")).youtube, before.youtube);
  await evaluate(ui,"document.querySelector('[name=allowedAccounts]').value='Invalid Name';document.querySelector('#config').requestSubmit()");
  await delay(700);
  assert.match(await evaluate(ui,"document.querySelector('#status').textContent"), /Display names won't work/);
  await evaluate(ui,"document.querySelector('[name=blockExplore]').checked=false;document.querySelector('#reload').click()");
  await delay(700);
  assert.equal(await evaluate(ui,"document.querySelector('[name=blockExplore]').checked"), true);
  await evaluate(ui,"document.querySelector('#profile').value='personal';document.querySelector('#profile').dispatchEvent(new Event('change'))");
  assert.match(await evaluate(ui,"document.querySelector('#active').textContent"), /switch to Personal Mode/);
  assert.equal(await evaluate(ui,"document.querySelector('[name=blockExplore]').checked"), false);
  // Whole-domain blocking wins over all adapter controls.
  await settings("add", {profileId:"focus",domain:"instagram.com"});
  const {targetId: blockedId} = await call("Target.createTarget", {url:"https://www.instagram.com/reel/one/"});
  const {sessionId: blocked} = await call("Target.attachToTarget", {targetId:blockedId,flatten:true});
  await delay(700);
  assert.match(await evaluate(blocked,"location.href"), /blocked\/blocked.html/);
  await settings("remove", {profileId:"focus",domain:"instagram.com"});
  await configure({});
  setEventHandler(() => {});
  console.log("PASS: Instagram browser fixtures: Reel limits/all/off, Explore, feed hiding/restoration, messaging routes, account controls, per-mode settings, reload, validation, and whole-domain precedence.");
  if (live) {
    const {targetId: liveId} = await call("Target.createTarget", {url:"https://www.instagram.com/nasa/"});
    const {sessionId: livePage} = await call("Target.attachToTarget", {targetId:liveId,flatten:true});
    await delay(10000);
    await configure({blockedAccounts:["@nasa"]});
    const report = await evaluate(livePage, "({url:location.href,title:document.title,main:!!document.querySelector('main'),reason:document.querySelector('#focusup-instagram-reason')?.textContent || ''})");
    console.log("LIVE Instagram:", JSON.stringify(report));
    if (new URL(report.url).pathname.replace(/\/$/, "") === "/nasa") {
      assert.match(report.reason, /account is blocked/);
      await configure({});
      assert.equal(await evaluate(livePage,"document.querySelector('#focusup-instagram-reason')?.textContent || ''"), "");
      console.log("PASS: live Instagram profile block and restore. Authenticated feeds, messages and Reels remain unverified on the live site.");
    } else {
      console.log("LIMITATION: Instagram redirected the public profile; authenticated live controls could not be verified.");
    }
  }
}
