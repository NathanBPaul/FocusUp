import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomain, buildDynamicRules } from "../src/core/rules.js";
test("normalize URLs, case, trailing dots and internationalized domains", () => {
  assert.equal(normalizeDomain(" HTTPS://Example.COM./path?q=1 "), "example.com");
  assert.equal(normalizeDomain("news.example.com/path"), "news.example.com");
  assert.equal(normalizeDomain("bücher.de"), "xn--bcher-kva.de");
  for (const input of [
    "",
    "localhost",
    "*.example.com",
    "ftp://example.com",
    "https://a:b@example.com",
    "bad domain.com",
    "https://-bad.com",
  ]) {
    assert.throws(() => normalizeDomain(input));
  }
});

test("whole domain matching includes subdomains without suffix collisions", () => {
  for (const hostname of ["example.com", "www.example.com", "deep.sub.example.com"]) {
    assert.equal(globalThis.FocusUpAccess.matchesDomain(hostname, "example.com"), true);
  }
  for (const hostname of ["notexample.com", "example.com.evil.org", "other.com"]) {
    assert.equal(globalThis.FocusUpAccess.matchesDomain(hostname, "example.com"), false);
  }
  const generated = buildDynamicRules(["example.com"], "focus", "chrome-extension://test/");
  assert.deepEqual(generated[0].condition, {
    requestDomains: ["example.com"],
    resourceTypes: ["main_frame"],
  });
  assert.match(generated[0].action.redirect.url, /mode=focus&domain=example.com$/);
});

let stored = { activeProfileId: "focus" }; // v0.1 migration
let dynamicRules = [];
let failRules = false;
let failStorage = false;
const listeners = {};
globalThis.chrome = {
  runtime: {
    id: "test",
    getURL: (path) => "chrome-extension://test/" + path,
    onMessage: { addListener: (fn) => (listeners.message = fn) },
    onInstalled: { addListener: (fn) => (listeners.install = fn) },
    onStartup: { addListener: (fn) => (listeners.startup = fn) },
  },
  storage: {
    local: {
      get: async () => structuredClone(stored),
      set: async (values) => {
        if (failStorage) {
          throw new Error("Storage failure");
        }
        Object.assign(stored, structuredClone(values));
        listeners.change(values, "local");
      },
    },
    onChanged: { addListener: (fn) => (listeners.change = fn) },
  },
  declarativeNetRequest: {
    getDynamicRules: async () => structuredClone(dynamicRules),
    updateDynamicRules: async ({ addRules }) => {
      if (failRules) {
        throw new Error("DNR failure");
      }
      dynamicRules = structuredClone(addRules);
    },
  },
};
await import("../src/background.js");
const send = (action, values = {}) =>
  new Promise((resolve) =>
    listeners.message({ type: "focusup-settings", action, ...values }, { id: "test" }, resolve),
  );
test("worker migrates settings, isolates profiles, persists, reconciles, and handles failures", async () => {
  let result = await send("get");
  assert.equal(result.settings.activeProfileId, "focus");
  assert.deepEqual(result.settings.blockedDomains, { focus: [], personal: [] });
  assert.equal(
    (await send("add", { profileId: "focus", domain: "https://Example.com/a" })).ok,
    true,
  );
  assert.deepEqual(stored.blockedDomains.focus, ["example.com"]);
  assert.equal(dynamicRules.length, 1);
  assert.equal((await send("add", { profileId: "focus", domain: "example.com" })).ok, false);
  await send("add", { profileId: "personal", domain: "other.com" });
  assert.deepEqual(dynamicRules[0].condition.requestDomains, ["example.com"]);
  await send("mode", { profileId: "personal" });
  assert.deepEqual(dynamicRules[0].condition.requestDomains, ["other.com"]);
  assert.match(dynamicRules[0].action.redirect.url, /mode=personal/);
  await Promise.all([
    send("mode", { profileId: "focus" }),
    send("mode", { profileId: "personal" }),
  ]);
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
  await send("youtube", {
    profileId: "focus",
    config: { shorts: "block", allowedChannels: ["@Study"] },
  });
  const saved = (await send("get")).settings;
  assert.equal(saved.youtube.focus.shorts, "block");
  assert.deepEqual(saved.youtube.focus.allowedChannels, ["@study"]);
  assert.equal(saved.youtube.personal.shorts, "allow");
  assert.equal(
    (await send("youtube", { profileId: "focus", config: { blockedChannels: ["bad name"] } })).ok,
    false,
  );
  assert.equal((await send("get")).settings.youtube.focus.shorts, "block");
  assert.equal((await send("get")).settings.instagram.focus.reels, "allow");
  assert.equal(
    (
      await send("instagram", {
        profileId: "focus",
        config: { reels: "limit", reelLimit: 2, allowedAccounts: ["@NASA"] },
      })
    ).ok,
    true,
  );
  const instagram = (await send("get")).settings.instagram;
  assert.equal(instagram.focus.reelLimit, 2);
  assert.deepEqual(instagram.focus.allowedAccounts, ["nasa"]);
  assert.equal(instagram.personal.reels, "allow");
  assert.equal(
    (await send("instagram", { profileId: "focus", config: { reelLimit: 0 } })).ok,
    false,
  );
  assert.equal((await send("get")).settings.instagram.focus.reelLimit, 2);
  assert.equal((await send("get")).settings.youtube.focus.shorts, "block");
  stored.blockedDomains.focus = Array.from({ length: 500 }, (_, i) => `d${i}.example.com`);
  assert.equal((await send("add", { profileId: "focus", domain: "overflow.com" })).ok, false);
});

test("presets preview/apply/undo, exceptions, custom lifecycle and stale previews", async () => {
  stored = { activeProfileId: "personal" };
  dynamicRules = [];
  let result = await send("get");
  assert.deepEqual(result.settings.allowedDomains, { focus: [], personal: [] });
  assert.deepEqual(result.settings.customPresets, []);
  const reference = { type: "official", category: "school", intensity: "focused" };
  await send("allowAdd", { profileId: "focus", domain: "https://learn.example.com/lesson" });
  let preview = (await send("presetPreview", { profileId: "focus", reference })).settings
    .presetPreview;
  assert.deepEqual(stored.blockedDomains, { focus: [], personal: [] });
  assert.equal(
    (await send("presetApply", { profileId: "focus", reference, previewKey: preview.key })).ok,
    true,
  );
  result = await send("get");
  assert.equal(result.settings.activeProfileId, "personal");
  assert.equal(result.settings.youtube.focus.shorts, "block");
  assert.equal(result.settings.youtube.personal.shorts, "allow");
  assert.deepEqual(result.settings.allowedDomains.focus, ["learn.example.com"]);
  assert.deepEqual(dynamicRules, []); // Inactive mode isn't enforced.
  assert.equal((await send("presetUndo", { profileId: "focus" })).ok, true);
  assert.equal((await send("get")).settings.youtube.focus.shorts, "allow");
  preview = (await send("presetPreview", { profileId: "focus", reference })).settings.presetPreview;
  await send("add", { profileId: "focus", domain: "example.com" });
  assert.equal(
    (await send("presetApply", { profileId: "focus", reference, previewKey: preview.key })).ok,
    false,
  );
  await send("mode", { profileId: "focus" });
  assert.equal(dynamicRules.find((rule) => rule.action.type === "allow").priority, 2);
  await send("presetSave", { profileId: "focus", name: "My setup" });
  let saved = (await send("get")).settings.customPresets[0];
  assert.deepEqual(saved.config.blockedDomains, ["example.com"]);
  assert.equal((await send("presetSave", { profileId: "focus", name: "my SETUP" })).ok, false);
  await send("presetDuplicate", { reference: { type: "custom", id: saved.id }, name: "Copy" });
  assert.equal((await send("get")).settings.customPresets.length, 2);
  await send("presetRename", { presetId: saved.id, name: "Renamed" });
  await send("youtube", { profileId: "focus", config: { shorts: "block" } });
  await send("presetUpdate", { profileId: "focus", presetId: saved.id, name: "Updated" });
  saved = (await send("get")).settings.customPresets[0];
  assert.equal(saved.name, "Updated");
  assert.equal(saved.config.youtube.shorts, "block");
  assert.equal(
    (await send("presetRename", { presetId: "official:school:focused", name: "No" })).ok,
    false,
  );
  await send("presetDelete", { presetId: saved.id });
  assert.equal((await send("get")).settings.customPresets.length, 1);
  preview = (await send("presetPreview", { profileId: "focus", reference })).settings.presetPreview;
  failStorage = true;
  assert.equal(
    (await send("presetApply", { profileId: "focus", reference, previewKey: preview.key })).ok,
    false,
  );
  failStorage = false;
  assert.ok(
    dynamicRules.some(
      (rule) =>
        rule.action.type === "redirect" && rule.condition.requestDomains.includes("example.com"),
    ),
  );
  assert.equal(
    dynamicRules.some((rule) => rule.condition.requestDomains.includes("tiktok.com")),
    false,
  );
  assert.deepEqual((await send("get")).settings.blockedDomains.focus, ["example.com"]);
  assert.equal(
    (await send("presetApply", { profileId: "focus", reference, previewKey: preview.key })).ok,
    true,
  );
  await send("allowAdd", { profileId: "focus", domain: "other.com" });
  assert.equal((await send("presetUndo", { profileId: "focus" })).ok, false);
  await send("allowRemove", { profileId: "focus", domain: "other.com" });
  assert.equal((await send("presetUndo", { profileId: "focus" })).ok, true);
  const oldLength = (await send("get")).settings.customPresets.length;
  for (let index = oldLength; index < 20; index++) {
    assert.equal(
      (await send("presetSave", { profileId: "focus", name: `Saved ${index}` })).ok,
      true,
    );
  }
  assert.equal((await send("presetSave", { profileId: "focus", name: "Overflow" })).ok, false);
  assert.equal((await send("get")).settings.customPresets.length, 20);
});

test("stored website lists keep valid entries, order and exceptions during cleanup", async () => {
  stored = {
    activeProfileId: "focus",
    blockedDomains: {
      focus: ["https://EXAMPLE.com/path", "bad domain", "example.com", "other.com"],
      personal: "not a list",
    },
    allowedDomains: { focus: ["learn.example.com", "LEARN.EXAMPLE.COM", null] },
  };
  const settings = (await send("get")).settings;
  assert.deepEqual(settings.blockedDomains.focus, ["example.com", "other.com"]);
  assert.deepEqual(settings.blockedDomains.personal, []);
  assert.deepEqual(settings.allowedDomains.focus, ["learn.example.com"]);
  assert.deepEqual(settings.allowedDomains.personal, []);
  assert.equal(settings.activeProfileId, "focus");
});
