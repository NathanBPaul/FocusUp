// Data-driven defaults; no blocking rules are enabled in v0.1.
export const PROFILES = Object.freeze({
  focus: Object.freeze({ id: "focus", name: "Focus", rules: [] }),
  personal: Object.freeze({ id: "personal", name: "Personal", rules: [] })
});
export const DEFAULT_PROFILE_ID = "personal";
export const isProfileId = id => Object.prototype.hasOwnProperty.call(PROFILES, id);
