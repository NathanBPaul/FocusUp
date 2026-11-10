import { PROFILES } from "../src/core/profiles.js";
import { getActiveProfileId, setActiveProfileId } from "../src/storage/settings.js";

const inputs = [...document.querySelectorAll('input[name="mode"]')];
const status = document.querySelector("#status");
function show(id) {
  for (const input of inputs) input.checked = input.value === id;
  status.textContent = `Active: ${PROFILES[id].name}`;
}
async function init() {
  inputs.forEach(input => input.disabled = true);
  try { show(await getActiveProfileId()); }
  catch (error) { status.textContent = "Unable to load settings."; console.error(error); }
  finally { inputs.forEach(input => input.disabled = false); }
}
inputs.forEach(input => input.addEventListener("change", async () => {
  if (!input.checked) return;
  inputs.forEach(item => item.disabled = true);
  status.textContent = "Saving…";
  try { await setActiveProfileId(input.value); show(input.value); }
  catch (error) { status.textContent = "Unable to save mode."; console.error(error); }
  finally { inputs.forEach(item => item.disabled = false); }
}));
init();
