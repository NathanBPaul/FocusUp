# FocusUp

FocusUp is a local-first Chrome extension for intentional browsing.

## Version 0.1
- Focus and Personal modes
- Mode persisted with chrome.storage.local
- Data-driven profile defaults and preliminary rules evaluator
- No website blocking yet

## Installation and test
1. Clone or download this repository.
2. Open chrome://extensions and enable Developer mode.
3. Choose Load unpacked and select the repository root.
4. Open the popup, select Focus, close and reopen it; Focus should remain selected.
5. Switch to Personal, reopen the popup and verify the selection persists.
6. Restart Chrome and verify the last mode is retained.

No external dependencies are needed. Future milestones: website blocking, YouTube content controls, customization, and privacy-conscious analytics.
