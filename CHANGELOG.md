# Changelog

Brief notes per release. Details live in the commit history; the release page of each version carries its own summary.

## 0.2.4 — 2026-11-03

- Licence-plate confirmation by majority vote (3 of 5 valid results; mismatch frames no longer reset the count)
- Serial monitor runs at 115200 end to end (code default, per-board config, upload config)
- Board-config sheet renders correctly in light mode
- Dev: Ctrl-C quits through the clean shutdown path; the Serial.list poll no longer floods the log

## 0.2.3 — 2026-11-02

- All four workshop programs as blocks (road sign, turnstile car, turnstile startup, turnstile plate) with templates in the Open ▾ menu; the road-sign program is the S3 starter
- AI Eye firmware burn: Compile & Upload on the "AI Eye firmware" program builds and flashes the exported model firmware to the P4 (road-sign and plate variants); "Export Model" jumps to Block Coding with the program open and the board preselected
- Concurrent compiles no longer wedge the shell until restart
- AI Training: Koil's final wave (logo, licensing, Car License fixes, HK-governed EULA)
- Removed the S3 "AI Body" blocks — the S3 never runs the vision model

## 0.2.2 — 2026-10-29

- Serial Monitor: one-click Monitor button in Block Coding, auto-reconnect across page switches, full port handoff between AI Training and Block Coding
- Block Coding design refresh: AIoScout design language across the editor chrome (light & dark)
- Licensing: first-launch EULA gate, in-app Licenses page, Mixly attribution, third-party notices
- Upload fixes: Serial.begin ordering, huge_app partition for large models

## 0.2.1 — 2026-10-2x

- Home page with the AIoScout logo, intro cards and tutorial links (default landing)
- Serial ports released when switching subpages
- Per-board upload configs; CI builds the training backend from the fork's main
- App icon; logo color follows the theme

## 0.2.0 — 2026-10-1x

- Dark mode for the desktop shell (follows the system theme)
- Unified app-wide zoom (shell + both subpage views together)
- Starter programs on fresh canvases; template default
- Versionless artifact names for permanent latest-release download links; toolchain and compile fixes

## 0.1.0 — 2026-10-06

- First packaged release: macOS (arm64/x64) and Windows installers with the embedded AI Training backend and Block Coding editor
