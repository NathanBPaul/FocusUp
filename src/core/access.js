// Shared exception policy for network rules and website adapters.
(() => {
  function matchesDomain(hostname, domain) {
    const host = String(hostname).toLowerCase().replace(/\.$/, "");
    return (
      typeof domain === "string" && !!domain && (host === domain || host.endsWith(`.${domain}`))
    );
  }
  function isAllowedSite(hostname, domains = []) {
    return Array.isArray(domains) && domains.some((domain) => matchesDomain(hostname, domain));
  }
  globalThis.FocusUpAccess = Object.freeze({ matchesDomain, isAllowedSite });
})();
