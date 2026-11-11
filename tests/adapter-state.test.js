import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("YouTube ignores stale settings reads after rapid mode changes", async () => {
  const classes = new Set(),
    requests = [],
    tasks = [];
  let onChanged;
  const context = vm.createContext({
    console,
    URLSearchParams,
    location: { pathname: "/watch", search: "?v=test", hostname: "www.youtube.com" },
    document: {
      documentElement: {
        classList: {
          add: (...names) => names.forEach((name) => classes.add(name)),
          remove: (...names) => names.forEach((name) => classes.delete(name)),
          toggle: (name, enabled) => (enabled ? classes.add(name) : classes.delete(name)),
        },
      },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
    },
    window: { addEventListener: () => {} },
    MutationObserver: class {
      observe() {}
    },
    setInterval: () => {},
    setTimeout: (fn) => tasks.push(fn),
    chrome: {
      storage: {
        local: { get: () => new Promise((resolve) => requests.push(resolve)) },
        onChanged: {
          addListener: (fn) => {
            onChanged = fn;
          },
        },
      },
    },
  });
  for (const name of ["access", "youtube"]) {
    vm.runInContext(
      await readFile(new URL(`../src/core/${name}.js`, import.meta.url), "utf8"),
      context,
    );
  }
  vm.runInContext(
    await readFile(new URL("../src/adapters/youtube.js", import.meta.url), "utf8"),
    context,
  );
  onChanged({ youtube: {} }, "local");
  onChanged({ activeProfileId: {} }, "local");
  const latest = {
    activeProfileId: "focus",
    youtube: { focus: { hideRelated: true } },
    allowedDomains: { focus: [] },
  };
  requests[2](latest);
  await new Promise((resolve) => setImmediate(resolve));
  while (tasks.length) {
    tasks.shift()();
  }
  assert.equal(classes.has("focusup-related"), true);
  requests[0]({ activeProfileId: "personal", youtube: { personal: { hideRelated: false } } });
  requests[1]({ activeProfileId: "focus", youtube: { focus: { hideRelated: false } } });
  await new Promise((resolve) => setImmediate(resolve));
  while (tasks.length) {
    tasks.shift()();
  }
  assert.equal(classes.has("focusup-related"), true);
});
