// Mode identity; website and content settings are stored separately.
export const PROFILES = Object.freeze({
  focus: Object.freeze({ id: "focus", name: "Focus" }),
  personal: Object.freeze({ id: "personal", name: "Personal" }),
});
export const DEFAULT_PROFILE_ID = "personal";
export const isProfileId = (id) => Object.prototype.hasOwnProperty.call(PROFILES, id);
