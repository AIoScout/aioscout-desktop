## What's new in 0.2.7

- **AI Eye firmware burn, out of the box** — flashing a trained model to the AI Eye (P4) board now works in the installed app: the firmware sketches ship inside it, "Export" bakes your model straight into them, and Compile & Upload builds with the bundled toolchain. This whole flow previously required a developer checkout.
- **Smoother export** — exporting a model saves it immediately, the training app confirms, and a moment later Block Coding opens with the AI Eye firmware program ready for Compile & Upload.
- **Readable consoles** — the output console and serial monitor wrap long lines instead of scrolling sideways.

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
