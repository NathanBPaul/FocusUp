import { test } from "node:test";
import assert from "node:assert/strict";
import "../src/core/instagram.js";
const api = globalThis.FocusUpInstagram;
test("Instagram account input and permissive defaults", () => {
  assert.equal(api.account(" @NASA "), "nasa");
  assert.equal(api.account("https://www.instagram.com/NASA/?hl=en"), "nasa");
  for (const value of ["Display Name", "https://evil.org/nasa", "nasa/reels", "https://www.instagram.com/p/post/", "a..b", "direct", "@", "a."])
    assert.throws(() => api.account(value));
  assert.deepEqual(api.normalize({allowedAccounts:["@NASA", "nasa"]}).allowedAccounts, ["nasa"]);
  assert.equal(api.normalize({blockExplore:"true"}).blockExplore, false);
  for (const reelLimit of [0, 21, 1.5, "2"]) assert.throws(() => api.normalize({reelLimit}));
  for (const path of ["/", "/direct/inbox/", "/reel/one/", "/explore/", "/p/one/", "/nasa/"])
    assert.equal(api.reason(path, api.defaults()), "");
});
test("Independent restrictions, account priority and messaging access", () => {
  const config = {...api.defaults(), reels:"block", blockExplore:true, approvedOnly:true, allowedAccounts:["nasa"], blockedAccounts:["games"]};
  assert.match(api.reason("/reel/one/", config, ["nasa"]), /Reels/);
  assert.match(api.reason("/explore/", config), /Explore/);
  assert.equal(api.reason("/direct/t/thread/", config, ["games"]), "");
  assert.equal(api.reason("/nasa/", config, ["nasa"]), "");
  assert.match(api.reason("/p/one/", config, []), /identified/);
  assert.match(api.reason("/games/", config, ["games"]), /blocked/);
  assert.match(api.reason("/nasa/", {...config,blockedAccounts:["nasa"]}, ["nasa"]), /blocked/);
  assert.equal(api.route("/accounts/login/"), "other");
  assert.equal(api.reason("/notifications/", config), "");
  assert.equal(api.reason("/settings/", config), "");
  assert.equal(api.route("/reels/one/"), "reels");
  assert.equal(api.route("/nasa/reels/"), "reels");
  assert.match(api.reason("/nasa/reels/", config, ["nasa"]), /Reels/);
});
test("Reel allowance tracks distinct Reels and resets between visits", () => {
  const visit = api.visitTracker();
  assert.equal(visit.allows("", 1), false);
  assert.equal(visit.allows("one", 1), true);
  assert.equal(visit.allows("one", 1), true);
  assert.equal(visit.allows("two", 1), false);
  assert.equal(visit.allows("two", 2), true);
  assert.equal(visit.allows("three", 2), false);
  visit.reset();
  assert.equal(visit.allows("three", 1), true);
});
