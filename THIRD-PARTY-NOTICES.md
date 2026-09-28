# Third-Party Notices

AIoScout desktop bundles and builds on the following third-party software.
Each bundled component ships with (or links to) its own license; this file
summarizes the key obligations. This is not legal advice — for formal
compliance review consult counsel.

## The AIoScout desktop app code

Licensed under the PolyForm Noncommercial License 1.0.0 (see `LICENSE`) —
free for personal, educational, and noncommercial use; commercial use
requires a separate license from the AIoScout team.

## Bundled components

| Component | License | Notes |
|---|---|---|
| **Mixly Lite** (block-coding editor & server, `resources/mixly`) | Custom — see `resources/mixly/LICENSE` | Fork of [mixly/mixly_lite](https://github.com/mixly/mixly_lite). Its license requires retaining the "Mixly" software name and author information in modified versions; the bundled tree keeps its LICENSE and on-screen attribution intact. |
| **AI Training backend** (PyInstaller bundle) | Apache-2.0 components | Built from the AIoScout training app; embeds TensorFlow (`Apache-2.0`), Streamlit (`Apache-2.0`), pywebview (`BSD-3-Clause`), OpenCV (`Apache-2.0`), numpy (`BSD-3-Clause`), Pillow (`HPND/MIT-CMU`), pyserial (`BSD-3-Clause`). |
| **Electron** | MIT | [electron/electron](https://github.com/electron/electron) |
| **arduino-cli** (`resources/arduino-cli`) | GPL-3.0 | Unmodified binary of [arduino/arduino-cli](https://github.com/arduino/arduino-cli), distributed as a separate program invoked via subprocess ("mere aggregation"). Source and license: upstream repository. |
| **ESP32 Arduino core + toolchains** (`resources/Arduino15-seed`) | LGPL-2.1 (core) and upstream toolchain licenses | [espressif/arduino-esp32](https://github.com/espressif/arduino-esp32) and its bundled toolchains (GCC: GPL-3 with runtime exceptions; Espressif precompiled libraries: their own notices, included in the package tree). Distributed unmodified. |
| **Blockly** (inside the Mixly tree) | Apache-2.0 | [google/blockly](https://github.com/google/blockly) |
| **TensorFlow Lite Micro** (bundled with the ESP32 core) | Apache-2.0 | [tensorflow/tflite-micro](https://github.com/tensorflow/tflite-micro) |

## Trademarks

"Mixly" is the name of the upstream block-coding software and is retained in
this modified distribution as required by its license. AIoScout is the name
of this project and is not affiliated with the Mixly project.
