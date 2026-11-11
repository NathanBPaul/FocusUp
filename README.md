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
Run `npm test` (Node.js 22 or newer; no install needed) for domain normalization, matching, profile isolation, migration, rule updates, persistence, startup reconciliation, serialized switches, limits, and failure recovery.

Manual browser checks:
1. In Focus, add example.com. Visit https://example.com and https://www.example.com; both should show the FocusUp explanation.
2. Switch to Personal with an empty list and revisit example.com; it should load.
3. Add a different domain in Personal and verify each mode enforces only its own list.
4. Remove a domain, then revisit it; it should load.
5. Try a duplicate, invalid domain, and a full URL. Check the feedback and normalized list.
6. Close and reopen the popup, reload the extension, then restart Chrome; the mode and lists should remain.
7. Check that unrelated domains remain accessible and the extension has no service-worker errors.

Rules affect subsequent top-level navigations, including reloads. Already loaded pages are not forcibly closed. Embedded resources are not filtered. A blocked page records the mode/domain responsible at navigation time; after changing settings, visit the website again. Each mode supports up to 500 domains.

Next milestones: focus sessions (v0.6), commitments (v0.7), and private analytics (v0.8).

## YouTube controls (v0.3)
Open **Manage YouTube** from the popup. Select which mode to edit, configure it, and save. Editing does not activate a mode; switching modes in the popup applies its saved controls to open YouTube tabs.

- Shorts: allow, allow the first Short in a continuous Shorts visit, or block all. Leaving Shorts or switching modes resets the first-Short allowance. Reloading the tab also resets it; this is a browsing aid, not a commitment lock.
- Hide Home recommendations, related/end-screen recommendations, and selected distracting sidebar links.
- Allow or restrict search, subscriptions, and video pages.
- Save channel allowlists and blocklists as @handles or /channel/UC… URLs, one per line. Blocklist wins. Strict access permits videos only after an allowed creator is identified; unknown creators are blocked. Recognized channel cards are hidden according to these rules, too.
- Whole-domain blocks always apply before the YouTube content adapter. Both modes start with permissive YouTube defaults, preserving earlier settings.

Channel aliases are not resolved through an external API: save both the handle and channel ID when needed. Creator matching uses rendered links, so identification depends on YouTube's markup. Desktop YouTube is the primary tested layout; mobile layouts and embeds may lack creator metadata and remain blocked in strict mode. Content controls act after the document starts loading, pause blocked playback, and update on navigation; they are not a network-level guarantee that video data never loads. YouTube UI changes may require adapter updates.

Browser verification: with Node.js 22+ and Edge installed, run `node tests/browser-smoke.mjs`. Set `FOCUSUP_BROWSER` to another Chromium executable if needed. The test uses a temporary isolated browser profile, real DNR redirects, controlled YouTube document responses with the actual extension content scripts, and settings form interactions. Add `--live` to verify a live desktop watch page, channel lists, and persistence after reload. Live checks require network access and can be affected by consent or anti-bot pages. No packages need installing.

After updating the extension, reload it in chrome://extensions and refresh existing YouTube tabs once to inject the new adapter. Subsequent setting and mode changes apply automatically.

## Instagram controls (v0.4)
Open **Manage Instagram** from the popup, choose Focus Mode or Personal Mode, and save. Both modes start with unrestricted Instagram access; existing website and YouTube settings are preserved.

- Allow all Reels, block all Reels, or allow 1–20 distinct Reels during a visit. Choose 1 to stop after the first Reel. Returning to a previously allowed Reel doesn't use another allowance.
- Leaving Reels, switching modes, changing the Reel allowance, or reloading the tab starts a new visit. This is a browsing aid, not a commitment lock. Unidentified Reels remain blocked while a limit is active.
- Block Explore independently. Hide the homepage's main feed, including posts and stories, while leaving navigation outside the main feed available.
- Allow or block selected accounts using @usernames or profile links. Blocked accounts take priority; approved-accounts-only mode blocks unidentified accounts until an approved creator is recognized. Supported feed posts are hidden, and direct post/profile pages show an explanation.
- Messaging routes are kept accessible regardless of account, feed, Explore, or Reel settings. A Reel opened on a separate Reel page follows Reel restrictions. Media played inside a message may remain accessible. Whole-website blocking still blocks Instagram, including messages.

The desktop Instagram adapter uses profile URLs and article creator headers with matching post links. It doesn't guess ownership from comments or recommendations. Account restrictions depend on these elements being available; unfamiliar layouts can leave unknown accounts accessible when approved-accounts-only is off, or block unidentified posts when it is on. Stories outside the homepage and account grids without recognizable article headers aren't individually filtered. A generic Reels page without an identifiable Reel URL is blocked when a limit is active. Instagram layout changes may require adapter updates.

No additional permissions, backend, accounts, or dependencies are added. The adapter batches DOM changes and disconnects its observer when all controls are off. Content restrictions apply after document loading starts and pause blocked playback; they do not prevent all media data from downloading.

Verification: `npm test` includes Instagram policy, input, Reel allowance, migration and mode-isolation checks. `node tests/browser-smoke.mjs` also tests the actual Instagram adapter against controlled document responses: Reels, Explore, feed restoration, messaging routes, accounts, settings form validation, reload persistence, and DNR precedence. `--live` additionally attempts a public Instagram profile block/restore check. Live feeds, Reel scrolling, and DMs require a signed-in account and need a separate manual check; fixture tests don't prove support for every current Instagram layout.

To try it, reload FocusUp in chrome://extensions and refresh open Instagram tabs. In Focus Mode, save a Reel limit of 1, enable Explore blocking and feed hiding, then check those pages and messaging. Switch to Personal Mode with default settings and confirm access returns. Test your chosen account links, then close/reopen settings and restart Chrome to confirm persistence.

## Presets and exceptions (v0.5)
Open **Presets & exceptions** from the popup. Choose the mode to edit, a preset and a level, then select **Preview changes**. The comparison lists every supported setting before and after applying. Nothing changes until you select **Apply to Focus Mode** or **Apply to Personal Mode**. The other mode and its active/inactive state stay unchanged.

Built-in starting setups include School, College, Entrance Exams, Competitive Exams, Professional Work, Reading & Learning, and Habit Reset, each with Relaxed, Focused and Strict levels. They share a base of short-video controls, with suggestions tailored to the category (for example, game websites for School, subscriptions during exam preparation, or video access for Reading). These are editable suggestions, not automatic content classification or endorsements of particular learning channels.

Relaxed removes Shorts/Reels and suggests blocking TikTok. Focused hides additional feeds and recommendations and suggests more website blocks. Strict adds website blocks and approved-channel/account-only access. Strict initially has no approved channels or accounts: add them in Manage YouTube/Instagram before viewing their content, or explicitly allow the website. The preview warns about empty approved lists.

Applying a preset replaces the selected mode's blocked websites, content controls and channel/account lists with the previewed configuration. Existing allowed websites are preserved and combined with any allowed websites saved in the preset. Save your current mode as a custom preset first to keep a reusable copy. A one-step **Undo last preset** restores the prior configuration while it remains unchanged; later mode edits disable undo to protect newer changes. A changed preview or preset must be reviewed again before applying.

### Custom presets
Save any mode as a named preset, save a copy of a built-in or custom preset, rename a saved preset, or update it from the mode's current settings. Edit individual restrictions in the popup and Manage YouTube/Instagram, then update the saved preset from that mode. You can keep 20 saved presets with unique names of up to 60 characters. Applying, renaming or deleting a custom preset never edits a built-in template. Deleting a preset requires confirmation and doesn't change either mode's active settings.

### Website exceptions and priority
Allowed websites are explicit exceptions for one mode. They include subdomains, follow domain boundaries, and take priority over FocusUp's blocked websites **and content controls**. For example, `learn.example.com` remains accessible when `example.com` is blocked, while `other.example.com` stays blocked. Allowing `youtube.com` bypasses its Shorts, channel and recommendation controls on YouTube addresses; removing the exception restores those controls. The settings pages show when an exception bypasses their controls. An exception for a parent website doesn't allow embedded content served from a different domain.

Current priority is explicit website exceptions → mode restrictions → preset starting values → default access. Preset values become editable mode settings when applied; templates don't keep reapplying in the background. Protected access and commitments from the broader roadmap aren't implemented yet. Chrome DNR uses higher-priority allow rules for domain exceptions; content adapters use the same domain-boundary policy. Already-open website-blocked pages may need to be visited again after adding an exception. No accounts, external services, tracking or extra permissions are introduced.

### Preset verification
`npm test` covers all built-in levels, normalization, mode isolation, custom preset lifecycle, stale previews, preservation of exceptions, undo conflicts and storage-failure rollback. `node tests/browser-smoke.mjs` covers the actual settings UI, preview/cancel/apply/undo, custom operations and reload, real DNR parent-domain exceptions, and live updates to YouTube/Instagram exception handling on controlled pages. Use `--presets-only` to run just that browser flow. Set `FOCUSUP_BROWSER` to your Chromium executable; on this system Brave is installed. Existing YouTube and Instagram fixture/live tests remain available with `--live`.

## Code formatting
The project uses two-space indentation, consistent block braces and the settings in `.prettierrc.json`. To format source files without adding a project dependency, run:

```powershell
npm exec --yes --package=prettier@3.6.2 -- prettier --write src popup settings blocked tests manifest.json package.json .prettierrc.json
```

Formatting tools are development utilities; the extension itself still has no external runtime dependencies.
