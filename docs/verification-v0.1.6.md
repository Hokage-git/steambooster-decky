# v0.1.6 — store discovery and catalog purchases

## Reproduced failures

- The store offers adapter appended styles to `document.head` during initialization. A new Chromium execution context can exist before that element exists, causing initialization to fail. The old test fixtures always had a complete document.
- Top Up only recognized the old store navigation, catalog parent, or game purchase area. Current public Steam HTML uses `data-featuretarget="store-menu-v7"`; a hidden desktop catalog parent also took precedence over a visible responsive host.
- The live catalog displays a generic alert whenever checkout returns an error without a message. Original checkout returns `no-email` before order creation if Steam does not supply the email address. This reproduces one cause of the reported generic alert; the exact error on the user's Deck was not captured.

## Changes

- Defer offer loading until the purchase host is available. Reconcile the style element when the document head appears or is replaced.
- Place Top Up in the current store navigation; skip hidden ancestors and follow visibility changes. Support the responsive Purchase Options host and Steam's `data-panel` activation metadata.
- Prompt for email only after the explicit `no-email` response. Submit the confirmed address through the original checkout purchase handler. Correlate replies by a random request ID and validate the framework token. Do not retry a submitted order.
- Give catalog errors readable messages, including unknown order status. Keep the original website bridge and vendor bundles intact.

## Verification

41 Node tests and 40 Python tests pass. Original framework/checkout tests verify that missing email produces zero order requests, then an explicit email continuation creates exactly one mocked order and opens payment. Browser checks cover early-document store injection and the real cross-process website bridge with the email dialog. TypeScript and production build are also checked for the release.

No real payments or Steam Deck hardware tests were performed. Actual Game Mode visibility and controller navigation still need device confirmation. Service availability and genuine empty offer lists are outside this adapter's control.
