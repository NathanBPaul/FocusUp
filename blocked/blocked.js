import { PROFILES, isProfileId } from "../src/core/profiles.js";
import { getActiveProfileId } from "../src/storage/settings.js";
const params = new URLSearchParams(location.search);
const mode = params.get("mode");
const domain = params.get("domain");
if (isProfileId(mode) && domain) {
  document.querySelector("#reason").textContent =
    `${domain} was blocked by your ${PROFILES[mode].name} Mode settings when you opened it. This includes addresses within that website, too.`;
}
async function refresh() {
  try {
    const id = await getActiveProfileId();
    document.querySelector("#current").textContent =
      `You're currently using ${PROFILES[id].name} Mode.`;
  } catch {
    document.querySelector("#current").textContent =
      "Open FocusUp to check which mode you're using.";
  }
}
chrome.storage.onChanged.addListener(refresh);
refresh();
