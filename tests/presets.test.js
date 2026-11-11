import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES,
  INTENSITIES,
  officialPreset,
  normalizeConfig,
  applicationConfig,
  domainList,
  presetName,
} from "../src/core/presets.js";
import { buildDynamicRules } from "../src/core/rules.js";

test("every official preset and level is valid and independent", () => {
  for (const category of CATEGORIES) {
    for (const intensity of INTENSITIES) {
      const preset = officialPreset(category.id, intensity);
      assert.deepEqual(normalizeConfig(preset.config), preset.config);
      assert.equal(preset.config.youtube.shorts, "block");
      assert.equal(preset.config.youtube.strictChannels, intensity === "strict");
      preset.config.blockedDomains.push("example.com");
      assert.equal(
        officialPreset(category.id, intensity).config.blockedDomains.includes("example.com"),
        false,
      );
    }
  }
  assert.throws(() => officialPreset("bad", "focused"));
  assert.throws(() => officialPreset("school", "bad"));
});
test("exceptions win at domain boundaries and remain when applying presets", () => {
  const api = globalThis.FocusUpAccess;
  assert.equal(api.isAllowedSite("www.example.com", ["example.com"]), true);
  assert.equal(api.isAllowedSite("notexample.com", ["example.com"]), false);
  assert.equal(api.isAllowedSite("example.com.evil.org", ["example.com"]), false);
  assert.equal(api.isAllowedSite("example.com", ["learn.example.com"]), false);
  const current = normalizeConfig({ allowedDomains: ["learn.example.com"] });
  const next = applicationConfig(current, officialPreset("school", "focused"));
  assert.deepEqual(next.allowedDomains, ["learn.example.com"]);
  const rules = buildDynamicRules(
    ["example.com"],
    "focus",
    "chrome-extension://test/",
    next.allowedDomains,
  );
  assert.equal(rules[1].action.type, "allow");
  assert.ok(rules[1].priority > rules[0].priority);
  assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length);
});
test("custom configuration inputs are validated", () => {
  assert.deepEqual(domainList(["https://EXAMPLE.com/path", "example.com"]), ["example.com"]);
  assert.throws(() => domainList(["bad domain"]));
  assert.throws(() => domainList(Array(501).fill("example.com")));
  assert.equal(presetName(" My study setup "), "My study setup");
  for (const name of ["", " ", "x".repeat(61)]) {
    assert.throws(() => presetName(name));
  }
});
