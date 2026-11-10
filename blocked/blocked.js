import { PROFILES, isProfileId } from "../src/core/profiles.js";
import { getActiveProfileId } from "../src/storage/settings.js";
const params = new URLSearchParams(location.search);
const mode = params.get("mode");
const domain = params.get("domain");
if (isProfileId(mode) && domain)
  document.querySelector("#reason").textContent = `${domain} and its subdomains were blocked by your ${PROFILES[mode].name} mode settings when you visited.`;
async function refresh() {
  try {
    const id = await getActiveProfileId();
    document.querySelector("#current").textContent = `Current mode: ${PROFILES[id].name}.`;
  } catch { document.querySelector("#current").textContent = "Open the popup to check your current mode."; }
}
chrome.storage.onChanged.addListener(refresh);
refresh();
