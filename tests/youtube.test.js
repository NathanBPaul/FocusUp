import { test } from "node:test";
import assert from "node:assert/strict";
import "../src/core/youtube.js";
const api = globalThis.FocusUpYouTube;
test("YouTube defaults and channel normalization", () => {
  assert.equal(api.defaults().allowVideos, true);
  assert.equal(api.channel("https://www.youtube.com/@Example"), "@example");
  assert.throws(() => api.channel("https://evil.org/@example"));
  assert.throws(() => api.channel("Display name"));
  assert.throws(() => api.channel("@abc/videos"));
  assert.deepEqual(api.normalize({allowedChannels:["@Example","@example"]}).allowedChannels,["@example"]);
  assert.equal(api.normalize({allowSearch:"false"}).allowSearch,true);
});
test("page policy, unknown channels and explicit block precedence", () => {
  const config = {...api.defaults(), strictChannels:true, allowedChannels:["@study"], blockedChannels:["@games"]};
  assert.equal(api.reason("/watch",config,["@study"]),"");
  assert.match(api.reason("/watch",config,[]),/identified/);
  assert.match(api.reason("/watch",config,["@other"]),/allowlist/);
  assert.match(api.reason("/watch",{...config,blockedChannels:["@study"]},["@study"]),/blocked/);
  assert.match(api.reason("/shorts/a",{...config,shorts:"block"},["@study"]),/Shorts/);
  assert.match(api.reason("/results",{...config,allowSearch:false}),/Search/);
  assert.match(api.reason("/feed/subscriptions",{...config,allowSubscriptions:false}),/Subscriptions/);
  assert.equal(api.reason("/",config),"");
  assert.match(api.reason("/@games/videos",config,["@games"]),/blocked/);
  assert.equal(api.reason("/@study/videos",config,["@study"]),"");
  assert.match(api.reason("/embed/id",{...config,allowVideos:false}),/Video/);
});
