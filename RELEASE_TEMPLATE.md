## What's new in 0.2.6

- **Correct app icon** — the app now carries the actual AIoScout logo. Every earlier installer shipped a wrong placeholder image as the icon.
- **First working packaged builds** — coming from 0.2.4 or earlier: both subapps failed after install (Block Coding lost its bundled dependencies at packaging time; AI Training failed to launch its backend). Both now start normally.
- **Workshop templates refresh** — a plate-driven turnstile gate template (the arm swings at startup and again on each confirmed plate) replaces the timed startup demo; the turnstile car beeps twice before its right-turn obstacle bypass; road-sign ultrasonic reads in cm and the right-turn class number is corrected (LEFT=0, STOP=1, RIGHT=2).
- **Diagnostics** — service spawn errors, exit codes and child output are recorded to the logs folder in user data.

Full changelog: [`CHANGELOG.md`](https://github.com/AIoScout/aioscout-desktop/blob/main/CHANGELOG.md)

## Downloads

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `AIoScout-*.arm64.dmg` |
| macOS (Intel) | `AIoScout*-x64.dmg` |
| Windows | `AIoScout*-setup.exe` |

> **macOS note** — the app is unsigned. After dragging AIoScout.app into /Applications, run this once in Terminal; Gatekeeper otherwise reports the download as "damaged" and refuses to open it:
>
> ```
> xattr -cr /Applications/AIoScout.app
> ```

## Licenses

Before installing, you may review the licenses the app is distributed under:

- **AIoScout End User License Agreement** — shown on first launch (also in [`EULA.md`](https://github.com/AIoScout/aioscout-desktop/blob/main/EULA.md))
- **Third-party notices** — bundled components (Apache-2.0, MIT and other permissive licenses), including:
  - [Google Teachable Machine v1](https://github.com/googlecreativelab/teachable-machine-v1) — Apache-2.0 (used by the AI Training tool; its license screen appears on first use)
  - [Mixly](https://github.com/mixly/mixly_lite) by the Mixly Team @ Beijing Normal University — name and author information retained as its license requires (Block Coding editor)

By installing or using the app you accept the EULA.
