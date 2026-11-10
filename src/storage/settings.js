import { DEFAULT_PROFILE_ID, isProfileId } from "../core/profiles.js";
const KEY = "activeProfileId";
export async function getActiveProfileId() {
  const stored = await chrome.storage.local.get(KEY);
  return isProfileId(stored[KEY]) ? stored[KEY] : DEFAULT_PROFILE_ID;
}
export async function setActiveProfileId(id) {
  if (!isProfileId(id)) throw new RangeError("Unknown profile");
  await chrome.storage.local.set({ [KEY]: id });
}
