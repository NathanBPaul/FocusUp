// Each mode starts with an empty, user-configured blocklist.
export const PROFILES = Object.freeze({
  focus: Object.freeze({ id: "focus", name: "Focus", rules: [] }),
  personal: Object.freeze({ id: "personal", name: "Personal", rules: [] })
});
export const DEFAULT_PROFILE_ID = "personal";
export const isProfileId = id => Object.prototype.hasOwnProperty.call(PROFILES, id);
