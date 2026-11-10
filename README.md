# FocusUp

FocusUp is a local-first Manifest V3 Chrome extension for intentional browsing.

## Website blocking (v0.2)
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

Next milestones: Instagram controls (v0.4), presets (v0.5), focus sessions (v0.6), commitments (v0.7), and private analytics (v0.8).

## YouTube controls (v0.3)
Open **YouTube controls** from the popup. Select which mode to edit, configure it, and save. Editing does not activate a mode; switching modes in the popup applies its saved controls to open YouTube tabs.

- Shorts: allow, allow the first Short in a continuous Shorts visit, or block all. Leaving Shorts or switching modes resets the first-Short allowance. Reloading the tab also resets it; this is a browsing aid, not a commitment lock.
- Hide Home recommendations, related/end-screen recommendations, and selected distracting sidebar links.
- Allow or restrict search, subscriptions, and video pages.
- Save channel allowlists and blocklists as @handles or /channel/UC… URLs, one per line. Blocklist wins. Strict access permits videos only after an allowed creator is identified; unknown creators are blocked. Recognized channel cards are hidden according to these rules, too.
- Whole-domain blocks always apply before the YouTube content adapter. Both modes start with permissive YouTube defaults, preserving earlier settings.

Channel aliases are not resolved through an external API: save both the handle and channel ID when needed. Creator matching uses rendered links, so identification depends on YouTube's markup. Desktop YouTube is the primary tested layout; mobile layouts and embeds may lack creator metadata and remain blocked in strict mode. Content controls act after the document starts loading, pause blocked playback, and update on navigation; they are not a network-level guarantee that video data never loads. YouTube UI changes may require adapter updates.

Browser verification: with Node.js 22+ and Edge installed, run `node tests/browser-smoke.mjs`. Set `FOCUSUP_BROWSER` to another Chromium executable if needed. The test uses a temporary isolated browser profile, real DNR redirects, controlled YouTube document responses with the actual extension content scripts, and settings form interactions. Add `--live` to verify a live desktop watch page, channel lists, and persistence after reload. Live checks require network access and can be affected by consent or anti-bot pages. No packages need installing.

After updating the extension, reload it in chrome://extensions and refresh existing YouTube tabs once to inject the new adapter. Subsequent setting and mode changes apply automatically.
