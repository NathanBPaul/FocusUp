import { PROFILES } from "../src/core/profiles.js";
import { requestSettings } from "../src/storage/settings.js";
const inputs = [...document.querySelectorAll('input[name="mode"]')];
const status = document.querySelector("#status");
const domainInput = document.querySelector("#domain");
const list = document.querySelector("#domains");
let settings;
function show() {
  const id = settings.activeProfileId;
  for (const input of inputs) {
    input.checked = input.value === id;
  }
  document.querySelector("#list-title").textContent =
    `Websites blocked in ${PROFILES[id].name} Mode`;
  list.replaceChildren();
  for (const domain of settings.blockedDomains[id]) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = domain;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${domain}`);
    remove.addEventListener("click", () => run("remove", { profileId: id, domain }));
    item.append(name, remove);
    list.append(item);
  }
  document.querySelector("#empty").hidden = settings.blockedDomains[id].length > 0;
  const allowed = settings.allowedDomains[id].length;
  status.textContent = `You're using ${PROFILES[id].name} Mode. Your settings are applied.${allowed ? ` ${allowed} website ${allowed === 1 ? "exception is" : "exceptions are"} allowed.` : ""}`;
}
async function run(action, values = {}) {
  document.querySelectorAll("input, button").forEach((item) => (item.disabled = true));
  status.textContent = "Updating your settings…";
  try {
    settings = await requestSettings(action, values);
    show();
    if (action === "add") {
      domainInput.value = "";
    }
  } catch (error) {
    if (settings) {
      show();
    }
    const message = error.message || "";
    if (/already/.test(message)) {
      status.textContent = "This website is already blocked in this mode.";
    } else if (/500|up to/.test(message)) {
      status.textContent =
        "You can block up to 500 websites in each mode. Remove a website and try again.";
    } else if (/domain/.test(message)) {
      status.textContent = "Enter a website address, such as example.com, or paste a link.";
    } else {
      status.textContent =
        "Your settings couldn't be loaded or updated. Please try reloading your settings.";
    }
  } finally {
    document.querySelectorAll("input, button").forEach((item) => (item.disabled = !settings));
    document.querySelector("#retry").disabled = false;
  }
}
inputs.forEach((input) =>
  input.addEventListener("change", () => {
    if (input.checked) {
      run("mode", { profileId: input.value });
    }
  }),
);
document.querySelector("#domain-form").addEventListener("submit", (event) => {
  event.preventDefault();
  run("add", { profileId: settings.activeProfileId, domain: domainInput.value });
});
document.querySelector("#retry").addEventListener("click", () => run("get"));
run("get");
