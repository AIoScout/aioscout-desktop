## What's new in 0.2.4

- **Workshop blocks polish** — plate confirmation by majority vote (3 of 5, mismatch no longer resets), serial monitor fixed at 115200 end to end, board-config sheet renders correctly in light mode, the servo experiment is removed (the demo gate arm is a motor).
- **Dev exit** — Ctrl-C in dev now quits through the clean shutdown path.

## What's new in 0.2.3

- **Workshop programs as blocks** — all four workshop programs (road sign, turnstile car, turnstile startup, turnstile plate) are now built from SmartCar blocks: P4 link, line-follow, obstacle wait, left-motor and plate blocks; every template sits in the Open ▾ menu and the road-sign program is the default S3 starter.
- **AI Eye firmware burn** — the "AI Eye firmware" program makes Compile & Upload build and flash the model exported from AI Training straight to the P4 board (road-sign and plate firmwares). Exporting with "Export Model" jumps to Block Coding with the program open and the board preselected. Requires the workshop core (esp32_mannual); the app shows install guidance when it is missing.
- **AI Training updates** — Koil's final wave: new logo and licensing, Car License fixes and manual, HK-governed EULA.
- **Stability** — concurrent compiles no longer wedge the shell until restart; the S3 "AI Body" blocks are removed (vision always runs on the P4).

## What's new in 0.2.2

- **Serial Monitor** — one-click Monitor button in Block Coding (follows the selected port), auto-reconnect across page switches, and a full port handoff between AI Training and Block Coding.
- **Block Coding design refresh** — AIoScout design language across the editor chrome (light & dark).
- **Licensing** — first-launch EULA, in-app Licenses page, Mixly attribution, third-party notices and car-license recognition updates in AI Training.
- **Upload fixes** — Serial.begin ordering, huge_app partition for large models.

## Downloads

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `AIoScout-*.arm64.dmg` |
| macOS (Intel) | `AIoScout*-x64.dmg` |
| Windows | `AIoScout*-setup.exe` |

## Licenses

Before installing, you may review the licenses the app is distributed under:

- **AIoScout End User License Agreement** — shown on first launch (also in [`EULA.md`](https://github.com/AIoScout/aioscout-desktop/blob/main/EULA.md))
- **Third-party notices** — bundled components (Apache-2.0, MIT and other permissive licenses), including:
  - [Google Teachable Machine v1](https://github.com/googlecreativelab/teachable-machine-v1) — Apache-2.0 (used by the AI Training tool; its license screen appears on first use)
  - [Mixly](https://github.com/mixly/mixly_lite) by the Mixly Team @ Beijing Normal University — name and author information retained as its license requires (Block Coding editor)

By installing or using the app you accept the EULA.
