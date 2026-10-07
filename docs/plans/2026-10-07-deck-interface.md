# Steam Deck interface revision

User requested these changes and asked to continue implementation.

## Design

Keep the existing native Steam store catalog link. Open remote catalog/account/order pages in Steam's browser, retaining its Back and keyboard handling. Use the Decky route only for the local top-up form. Replace the added sticky toolbar with one compact top-up control beside store navigation/wallet controls. Keep Decky panel compact: actions, short connection status, expandable settings; remove the promotional header and redundant store action.

Display real SteamBalance offers inside the Steam Purchase Options area. Keep original checkout transport and purchase handler. Do not require an exact desktop edition match just to display an available item; show edition and region explicitly. Claim a cheaper price only when package/currency/price can be compared. Empty results must not produce dead buttons. Hide the original desktop promotional/top-up blocks in this Deck adaptation. Reconcile DOM changes and remove all additions on unload.

Bind editable top-up fields to Steam's own virtual keyboard. Touching a field or activating it with A opens the keyboard. Preserve the original amount/calculation/payment logic, and eliminate the extra X/editor/Apply flow. Keep exactly one controller focus outline; do not treat checkbox selection as text input. Preserve payment-order reopening without another POST.

## Implementation sequence

- [x] Store task: implement contextual store control and a scoped Decky offers plugin using original checkout bus contracts. Add fixtures for available, empty, failed, and replaced purchase sections; verify action routing and cleanup. Keep catalog link untouched.
- [x] Navigation task: classify remote windows as native browser destinations; retain only HTML forms in Decky. Add regression tests for Back/payment behavior and keep native-window acknowledgements after navigation.
- [x] Input task: discover Steam's virtual keyboard hook by its stable method signatures, bind to the actual iframe document, route A/touch input activation, and restore focus after keyboard dismissal. Test input-versus-checkbox behavior and lifecycle cleanup.
- [x] Panel task: reduce header height, remove redundant store launcher, retain status/error/settings and last-payment recovery.
- [x] Integrate: update browser fixture to cover the new store adapter and form input. Run TypeScript, Node, Python, production build and isolated Chromium checks. Inspect screenshots at 1280x800 and compact size.
- [x] Release: document verified behavior and device limitations, bump to next preview, build/check ZIP, push main and publish release under the existing authorization.

## Validation limits

No access to physical Steam Deck. No real purchase, activation or valuation submission during tests. Steam's keyboard and Game Mode navigation require device confirmation; mock checks do not establish those hardware behaviors.
