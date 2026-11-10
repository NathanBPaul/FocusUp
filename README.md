# FocusUp

FocusUp is a local-first Manifest V3 Chrome extension for intentional browsing.

## Version 0.2
- Separate custom domain blocklists for Focus and Personal.
- Add a domain or HTTP(S) URL; URLs are normalized to their hostname. Remove entries individually.
- A listed domain includes its subdomains (example.com includes www.example.com). A listed subdomain does not block its parent.
- DNR redirects matching top-level HTTP(S) navigations to a local explanation page.
- Switching modes replaces the active dynamic rules immediately. An empty list allows all websites.
- Both lists and the selected mode persist locally across browser restarts. Existing v0.1 mode selections are preserved.
- No external services, dependencies, browsing history collection, or automatic categories.

## Installation
1. Open chrome://extensions and enable Developer mode.
2. Choose Load unpacked and select this repository root.
3. If updating from v0.1, reload the extension and accept the new permissions if prompted.

Storage saves your settings. declarativeNetRequest and HTTP(S) host access allow the extension to redirect user-selected websites. Only the blocked HTML entry point is web accessible. Chrome internal pages and other non-HTTP(S) URLs are outside this feature.

## Verification
Run `npm test` (Node.js 18 or newer; no install needed) for domain normalization, matching, profile isolation, migration, rule updates, persistence, startup reconciliation, serialized switches, limits, and failure recovery.

Manual browser checks:
1. In Focus, add example.com. Visit https://example.com and https://www.example.com; both should show the FocusUp explanation.
2. Switch to Personal with an empty list and revisit example.com; it should load.
3. Add a different domain in Personal and verify each mode enforces only its own list.
4. Remove a domain, then revisit it; it should load.
5. Try a duplicate, invalid domain, and a full URL. Check the feedback and normalized list.
6. Close and reopen the popup, reload the extension, then restart Chrome; the mode and lists should remain.
7. Check that unrelated domains remain accessible and the extension has no service-worker errors.

Rules affect subsequent top-level navigations, including reloads. Already loaded pages are not forcibly closed. Embedded resources are not filtered. A blocked page records the mode/domain responsible at navigation time; after changing settings, visit the website again. Each mode supports up to 500 domains.

Future milestones include YouTube content controls, presets, commitments, and private analytics.
