# Changelog

Brief notes per release. Details live in the commit history; the release page of each version carries its own summary.

## 0.2.7 — 2026-11-11

- AI Eye (P4) firmware burn works in packaged builds for the first time: the firmware sketches ship with the app (writable copies materialize under user data) and both training-app exports default into them — previously the whole chain only worked from a dev checkout
- Fixed packaging that stripped all 45 bundled libraries from the esp32p4 custom core (a bsdtar exclude matched at every depth), which broke P4 compiles at #include <SD_MMC.h>
- Export flow: models save into the library directly (no interactive dialog), the training app confirms, and ~2 s later the app jumps to Block Coding with the AI Eye firmware program open
- Output console and serial monitor wrap long lines instead of scrolling sideways
- Packaged builds now watch the firmware-export dirs (the auto-jump previously watched a dev-only path and never fired)

## 0.2.6 — 2026-11-10

- Correct app icon: the bundled icon.png was a wrong placeholder image, so every packaged build shipped foreign art as the app icon. Now the actual AIoScout logo (light-theme orange, rasterized from the brand SVG, full 16-1024px icns set); Windows installers pick it up too

## 0.2.5 — 2026-11-10

- Fixed packaged builds: both subapps failed after install (Block Coding's bundled dependencies were pruned at packaging time; AI Training spawned the PyInstaller bundle folder instead of the executable). All packaged releases up to 0.2.4 were affected
- Block Coding templates: plate-driven turnstile gate template replaces the timed startup demo (arm swings on each confirmed plate, 10 s re-arm wait); the turnstile car beeps twice before its right-turn obstacle bypass; each template reports its own load message
- Road-sign: ultrasonic distance now reads in cm; right-turn class corrected to 2 (P4 mapping LEFT=0, STOP=1, RIGHT=2)
- Sidecar services log spawn errors, exit codes and child output under userData/logs

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
