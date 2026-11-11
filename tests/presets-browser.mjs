import assert from "node:assert/strict";

export async function testPresets({ call, evaluate, settings, delay, extension, setEventHandler }) {
  async function waitFor(session, expression, expected) {
    for (let attempt = 0; attempt < 50; attempt++) {
      if ((await evaluate(session, expression)) === expected) {
        return;
      }
      await delay(150);
    }
    assert.equal(
      await evaluate(session, expression),
      expected,
      `Timed out waiting for: ${expression}`,
    );
  }
  await settings("mode", { profileId: "focus" });
  const baseline = await settings("get");
  const { targetId } = await call("Target.createTarget", {
    url: extension + "/settings/presets.html",
  });
  const { sessionId: ui } = await call("Target.attachToTarget", { targetId, flatten: true });
  await delay(800);
  assert.equal(
    await evaluate(ui, "document.querySelector('h1').textContent"),
    "Presets & exceptions",
  );
  const click = async (id) => {
    await evaluate(ui, `document.getElementById(${JSON.stringify(id)}).click()`);
    await delay(700);
  };
  const choose = async (id, value) => {
    await evaluate(
      ui,
      `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(value)};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('change'))`,
    );
    await delay(150);
  };
  const name = (value) =>
    evaluate(ui, `document.getElementById('preset-name').value=${JSON.stringify(value)}`);
  const modeConfig = (state) => ({
    blockedDomains: state.blockedDomains.focus,
    allowedDomains: state.allowedDomains.focus,
    youtube: state.youtube.focus,
    instagram: state.instagram.focus,
  });
  await click("preview");
  assert.equal(await evaluate(ui, "document.querySelector('#preview-panel').hidden"), false);
  assert.deepEqual(modeConfig(await settings("get")), modeConfig(baseline));
  await click("cancel-preview");
  assert.deepEqual(modeConfig(await settings("get")), modeConfig(baseline));
  await choose("intensity", "strict");
  await click("preview");
  assert.match(
    await evaluate(ui, "document.querySelector('#warnings').textContent"),
    /No YouTube channels/,
  );
  assert.match(
    await evaluate(ui, "document.querySelector('#warnings').textContent"),
    /No Instagram accounts/,
  );
  await click("cancel-preview");
  await choose("intensity", "focused");
  await click("preview");
  await click("apply");
  let state = await settings("get");
  assert.equal(state.youtube.focus.shorts, "block");
  assert.deepEqual(state.youtube.personal, baseline.youtube.personal);
  assert.equal(state.activeProfileId, "focus");
  await click("undo");
  assert.deepEqual(modeConfig(await settings("get")), modeConfig(baseline));
  await name("My study setup");
  await click("save-current");
  state = await settings("get");
  const saved = state.customPresets.find((item) => item.name === "My study setup");
  assert.ok(saved);
  await name("School copy");
  await click("duplicate");
  const copy = (await settings("get")).customPresets.find((item) => item.name === "School copy");
  assert.ok(copy);
  assert.equal(copy.config.youtube.shorts, "block");
  await choose("preset", saved.id);
  await name("Evening study");
  await click("rename");
  assert.equal(
    (await settings("get")).customPresets.find((item) => item.id === saved.id).name,
    "Evening study",
  );
  await settings("youtube", {
    profileId: "focus",
    config: { ...baseline.youtube.focus, hideHome: true },
  });
  await delay(700);
  await click("update");
  assert.equal(
    (await settings("get")).customPresets.find((item) => item.id === saved.id).config.youtube
      .hideHome,
    true,
  );
  await call("Page.reload", {}, ui);
  await delay(700);
  assert.ok(
    (
      await evaluate(
        ui,
        "[...document.querySelector('#preset').options].map(option=>option.textContent)",
      )
    ).includes("Evening study"),
  );
  await choose("preset", saved.id);
  await click("delete");
  assert.ok((await settings("get")).customPresets.some((item) => item.id === saved.id));
  await click("cancel-delete");
  await click("delete");
  await click("confirm-delete");
  assert.equal(
    (await settings("get")).customPresets.some((item) => item.id === saved.id),
    false,
  );
  // An exception added through the UI wins over a parent-domain block in real DNR.
  await settings("add", { profileId: "focus", domain: "example.com" });
  await delay(700);
  await evaluate(
    ui,
    "document.getElementById('allowed-domain').value='learn.example.com';document.getElementById('allow-form').requestSubmit()",
  );
  await delay(700);
  assert.ok((await settings("get")).allowedDomains.focus.includes("learn.example.com"));
  const { targetId: allowedId } = await call("Target.createTarget", { url: "about:blank" });
  const { sessionId: site } = await call("Target.attachToTarget", {
    targetId: allowedId,
    flatten: true,
  });
  const fixture =
    '<!doctype html><html><body><h1>Allowed website fixture</h1><div id="related">Recommendations</div><main><article><header><a href="/nasa/">NASA</a></header><a href="/reel/one/">Reel</a></article></main></body></html>';
  setEventHandler((message) => {
    if (message.method === "Fetch.requestPaused") {
      call(
        "Fetch.fulfillRequest",
        {
          requestId: message.params.requestId,
          responseCode: 200,
          responseHeaders: [{ name: "Content-Type", value: "text/html" }],
          body: Buffer.from(fixture).toString("base64"),
        },
        message.sessionId,
      ).catch(console.error);
    }
  });
  await call(
    "Fetch.enable",
    {
      patterns: [
        {
          urlPattern: "https://learn.example.com/*",
          resourceType: "Document",
          requestStage: "Request",
        },
        {
          urlPattern: "https://www.youtube.com/*",
          resourceType: "Document",
          requestStage: "Request",
        },
        {
          urlPattern: "https://www.instagram.com/*",
          resourceType: "Document",
          requestStage: "Request",
        },
      ],
    },
    site,
  );
  await call("Page.navigate", { url: "https://learn.example.com/lesson" }, site);
  await delay(700);
  assert.equal(await evaluate(site, "location.hostname"), "learn.example.com");
  assert.match(await evaluate(site, "document.body.textContent"), /Allowed website fixture/);
  await call("Page.navigate", { url: "https://other.example.com/" }, site);
  await delay(700);
  assert.match(await evaluate(site, "location.href"), /blocked\/blocked.html/);
  // Exceptions also clear active content overlays and hiding styles in already-open tabs.
  await settings("youtube", {
    profileId: "focus",
    config: { allowVideos: false, hideRelated: true },
  });
  await call("Page.navigate", { url: "https://www.youtube.com/watch?v=test" }, site);
  await delay(700);
  await waitFor(site, "!!document.querySelector('#focusup-gate')", true);
  await settings("allowAdd", { profileId: "focus", domain: "youtube.com" });
  await delay(700);
  const { targetId: ytSettingsId } = await call("Target.createTarget", {
    url: extension + "/settings/youtube.html",
  });
  const { sessionId: ytSettings } = await call("Target.attachToTarget", {
    targetId: ytSettingsId,
    flatten: true,
  });
  await delay(700);
  assert.equal(
    await evaluate(ytSettings, "document.querySelector('#exception-note').hidden"),
    false,
  );
  await waitFor(site, "!!document.querySelector('#focusup-gate')", false);
  assert.notEqual(
    await evaluate(site, "getComputedStyle(document.querySelector('#related')).display"),
    "none",
  );
  await settings("mode", { profileId: "personal" });
  await delay(700);
  await waitFor(site, "!!document.querySelector('#focusup-gate')", false);
  await settings("mode", { profileId: "focus" });
  await settings("allowRemove", { profileId: "focus", domain: "youtube.com" });
  await delay(700);
  assert.equal(
    await evaluate(ytSettings, "document.querySelector('#exception-note').hidden"),
    true,
  );
  await waitFor(site, "!!document.querySelector('#focusup-gate')", true);
  await settings("instagram", { profileId: "focus", config: { reels: "block" } });
  await call("Page.navigate", { url: "https://www.instagram.com/reel/one/" }, site);
  await delay(800);
  await waitFor(site, "!!document.querySelector('#focusup-instagram-gate')", true);
  await settings("allowAdd", { profileId: "focus", domain: "instagram.com" });
  await delay(700);
  const { targetId: igSettingsId } = await call("Target.createTarget", {
    url: extension + "/settings/instagram.html",
  });
  const { sessionId: igSettings } = await call("Target.attachToTarget", {
    targetId: igSettingsId,
    flatten: true,
  });
  await delay(700);
  assert.equal(
    await evaluate(igSettings, "document.querySelector('#exception-note').hidden"),
    false,
  );
  await waitFor(site, "!!document.querySelector('#focusup-instagram-gate')", false);
  await settings("allowRemove", { profileId: "focus", domain: "instagram.com" });
  await delay(700);
  assert.equal(
    await evaluate(igSettings, "document.querySelector('#exception-note').hidden"),
    true,
  );
  await waitFor(site, "!!document.querySelector('#focusup-instagram-gate')", true);
  await call("Fetch.disable", {}, site);
  setEventHandler(() => {});
  // Applying presets preserves explicit exceptions, and external edits invalidate previews.
  await delay(700);
  await choose("preset", "official:college");
  await click("preview");
  await settings("youtube", { profileId: "focus", config: { shorts: "first" } });
  await delay(700);
  assert.equal(await evaluate(ui, "document.querySelector('#preview-panel').hidden"), true);
  await click("preview");
  await click("apply");
  assert.ok((await settings("get")).allowedDomains.focus.includes("learn.example.com"));
  await click("undo");
  await choose("profile", "personal");
  assert.match(
    await evaluate(ui, "document.querySelector('#active').textContent"),
    /switch to Personal Mode/,
  );
  assert.deepEqual((await settings("get")).youtube.personal, baseline.youtube.personal);
  // Leave this isolated test profile tidy for later checks.
  await settings("allowRemove", { profileId: "focus", domain: "learn.example.com" });
  await settings("remove", { profileId: "focus", domain: "example.com" });
  await settings("youtube", { profileId: "focus", config: baseline.youtube.focus });
  await settings("instagram", { profileId: "focus", config: baseline.instagram.focus });
  await settings("presetDelete", { presetId: copy.id });
  console.log(
    "PASS: presets browser flow: preview/cancel/apply/undo, strict warnings, custom save/copy/update/rename/delete, persistence, stale preview invalidation, mode isolation, and domain/content exception priority.",
  );
}
