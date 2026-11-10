import { requestSettings } from "../src/storage/settings.js";
const labels = {hideHome:"Hide Home recommendations",hideRelated:"Hide recommendations beside/after videos",hideSidebar:"Hide distracting sidebar links",allowSearch:"Allow search",allowSubscriptions:"Allow subscriptions",allowVideos:"Allow video pages",strictChannels:"Only allow videos from allowed channels"};
const form = document.querySelector("#config"), profile = document.querySelector("#profile"), status = document.querySelector("#status");
let settings;
for (const [key,text] of Object.entries(labels)) {
  const label = document.createElement("label"), input = document.createElement("input");
  input.type = "checkbox"; input.name = key; label.append(input,document.createTextNode(text));
  document.querySelector("#toggles").append(label);
}
function show() {
  const config = settings.youtube[profile.value];
  for (const [key,value] of Object.entries(config)) {
    if (Array.isArray(value)) form.elements[key].value = value.join("\n");
    else if (typeof value === "boolean") form.elements[key].checked = value;
    else form.elements[key].value = value;
  }
  document.querySelector("#active").textContent = "Active mode: " + settings.activeProfileId + ". Editing a mode does not activate it.";
}
async function load() {
  try {settings = await requestSettings(); profile.value = settings.activeProfileId; show(); form.querySelector("fieldset").disabled = false; status.textContent = "Settings loaded.";}
  catch(error){status.textContent = error.message;}
}
profile.addEventListener("change",()=>{if(settings){show();status.textContent="Loaded saved controls for " + profile.value;}});
form.addEventListener("submit",async event=>{
  event.preventDefault();
  const config = {};
  for(const key of Object.keys(labels)) config[key] = form.elements[key].checked;
  config.shorts = form.elements.shorts.value;
  for(const key of ["allowedChannels","blockedChannels"]) config[key] = form.elements[key].value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  form.querySelector("fieldset").disabled = true; profile.disabled = true;
  try {settings = await requestSettings("youtube",{profileId:profile.value,config});show();status.textContent="Saved. Open YouTube tabs apply these controls automatically.";}
  catch(error){status.textContent=error.message;}
  finally {form.querySelector("fieldset").disabled=false;profile.disabled=false;}
});
document.querySelector("#reload").addEventListener("click",load);
load();