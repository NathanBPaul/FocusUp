import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomain, evaluateAccess, buildDynamicRules } from "../src/core/rules.js";
test("normalize URLs, case, trailing dots and internationalized domains", () => {
  assert.equal(normalizeDomain(" HTTPS://Example.COM./path?q=1 "), "example.com");
  assert.equal(normalizeDomain("news.example.com/path"), "news.example.com");
  assert.equal(normalizeDomain("bücher.de"), "xn--bcher-kva.de");
  for (const input of ["", "localhost", "*.example.com", "ftp://example.com", "https://a:b@example.com", "bad domain.com", "https://-bad.com"])
    assert.throws(() => normalizeDomain(input));
});
test("whole domain matching includes subdomains without suffix collisions", () => {
  const rules = [{ id: 1, effect: "block", matches: { hostname: "example.com" } }];
  for (const hostname of ["example.com", "www.example.com", "deep.sub.example.com"])
    assert.equal(evaluateAccess({ hostname }, rules).allowed, false);
  for (const hostname of ["notexample.com", "example.com.evil.org", "other.com"])
    assert.equal(evaluateAccess({ hostname }, rules).allowed, true);
  const generated = buildDynamicRules(["example.com"], "focus", "chrome-extension://test/");
  assert.deepEqual(generated[0].condition, { requestDomains: ["example.com"], resourceTypes: ["main_frame"] });
  assert.match(generated[0].action.redirect.url, /mode=focus&domain=example.com$/);
});

let stored = { activeProfileId: "focus" }; // v0.1 migration
let dynamicRules = [];
let failRules = false;
let failStorage = false;
const listeners = {};
globalThis.chrome = {
  runtime: {
    id: "test", getURL: path => "chrome-extension://test/" + path,
    onMessage: { addListener: fn => listeners.message = fn },
    onInstalled: { addListener: fn => listeners.install = fn },
    onStartup: { addListener: fn => listeners.startup = fn }
  },
  storage: {
    local: {
      get: async () => structuredClone(stored),
      set: async values => {
        if (failStorage) throw new Error("Storage failure");
        Object.assign(stored, structuredClone(values));
        listeners.change(values, "local");
      }
    },
    onChanged: { addListener: fn => listeners.change = fn }
  },
  declarativeNetRequest: {
    getDynamicRules: async () => structuredClone(dynamicRules),
    updateDynamicRules: async ({ addRules }) => {
      if (failRules) throw new Error("DNR failure");
      dynamicRules = structuredClone(addRules);
    }
  }
};
await import("../src/background.js");
const send = (action, values = {}) => new Promise(resolve =>
  listeners.message({ type: "focusup-settings", action, ...values }, { id: "test" }, resolve));
test("worker migrates settings, isolates profiles, persists, reconciles, and handles failures", async () => {
  let result = await send("get");
  assert.equal(result.settings.activeProfileId, "focus");
  assert.deepEqual(result.settings.blockedDomains, { focus: [], personal: [] });
  assert.equal((await send("add", { profileId: "focus", domain: "https://Example.com/a" })).ok, true);
  assert.deepEqual(stored.blockedDomains.focus, ["example.com"]);
  assert.equal(dynamicRules.length, 1);
  assert.equal((await send("add", { profileId: "focus", domain: "example.com" })).ok, false);
  await send("add", { profileId: "personal", domain: "other.com" });
  assert.deepEqual(dynamicRules[0].condition.requestDomains, ["example.com"]);
  await send("mode", { profileId: "personal" });
  assert.deepEqual(dynamicRules[0].condition.requestDomains, ["other.com"]);
  assert.match(dynamicRules[0].action.redirect.url, /mode=personal/);
  await Promise.all([send("mode", { profileId: "focus" }), send("mode", { profileId: "personal" })]);
  assert.equal(stored.activeProfileId, "personal");
  failRules = true;
  assert.equal((await send("mode", { profileId: "focus" })).ok, false);
  assert.equal(stored.activeProfileId, "personal");
  failRules = false;
  failStorage = true;
  assert.equal((await send("mode", { profileId: "focus" })).ok, false);
  assert.deepEqual(dynamicRules[0].condition.requestDomains, ["other.com"]);
  failStorage = false;
  dynamicRules = [];
  listeners.startup();
  await send("get");
  assert.deepEqual(dynamicRules[0].condition.requestDomains, ["other.com"]);
  await send("remove", { profileId: "personal", domain: "other.com" });
  assert.deepEqual(dynamicRules, []);
  assert.equal((await send("mode", { profileId: "invalid" })).ok, false);
  assert.equal((await send("add", { profileId: "focus", domain: "*.bad.com" })).ok, false);
  await send("youtube", { profileId: "focus", config: { shorts: "block", allowedChannels: ["@Study"] } });
  const saved = (await send("get")).settings;
  assert.equal(saved.youtube.focus.shorts, "block");
  assert.deepEqual(saved.youtube.focus.allowedChannels, ["@study"]);
  assert.equal(saved.youtube.personal.shorts, "allow");
  assert.equal((await send("youtube", { profileId: "focus", config: { blockedChannels: ["bad name"] } })).ok, false);
  assert.equal((await send("get")).settings.youtube.focus.shorts, "block");
  assert.equal((await send("get")).settings.instagram.focus.reels, "allow");
  assert.equal((await send("instagram", {profileId:"focus",config:{reels:"limit",reelLimit:2,allowedAccounts:["@NASA"]}})).ok, true);
  const instagram = (await send("get")).settings.instagram;
  assert.equal(instagram.focus.reelLimit, 2);
  assert.deepEqual(instagram.focus.allowedAccounts, ["nasa"]);
  assert.equal(instagram.personal.reels, "allow");
  assert.equal((await send("instagram", {profileId:"focus",config:{reelLimit:0}})).ok, false);
  assert.equal((await send("get")).settings.instagram.focus.reelLimit, 2);
  assert.equal((await send("get")).settings.youtube.focus.shorts, "block");
  stored.blockedDomains.focus = Array.from({ length: 500 }, (_, i) => `d${i}.example.com`);
  assert.equal((await send("add", { profileId: "focus", domain: "overflow.com" })).ok, false);
});
