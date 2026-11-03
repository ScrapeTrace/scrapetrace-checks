# Keyboard check source record

Reference revision: Chromium tag `152.0.7977.82`. Read on 3 November 2026. Browser code does not fetch any of these references at runtime.

| File | SHA-256 of fetched source |
| --- | --- |
| [ui/events/keycodes/dom_us_layout_data.h](https://github.com/chromium/chromium/blob/152.0.7977.82/ui/events/keycodes/dom_us_layout_data.h) | `72775b50be021a2c5f3d0ec08c11fe28e5622daf1493ab67a90f4c7803e6ed38` |
| [ui/events/keycodes/dom/dom_keyboard_layout.h](https://github.com/chromium/chromium/blob/152.0.7977.82/ui/events/keycodes/dom/dom_keyboard_layout.h) | `0245618380920225f8c51816f3c37029a8d48850174301e5162ca7141813d5f8` |
| [ui/linux/fallback_linux_ui.cc](https://github.com/chromium/chromium/blob/152.0.7977.82/ui/linux/fallback_linux_ui.cc) | `9bdd0076642f60ccb5295a7ff836ee53ba7077041b098f4d22b4f8a38ad6638b` |
| [ui/events/ozone/layout/stub/stub_keyboard_layout_engine.cc](https://github.com/chromium/chromium/blob/152.0.7977.82/ui/events/ozone/layout/stub/stub_keyboard_layout_engine.cc) | `38b4c4f7d4e5d7bb2a46a9a5953c86cd639c167f35c7b91681716043d09a41c0` |

The first two files supply the regular US character data and the ordered 50 writing-system key codes. The fallback Linux UI file delegates to GenerateDomKeyboardLayoutMap; the stub engine falls through to DomCodeToUsLayoutDomKey when its testing override table does not answer. This source path explains why the compiled-in US data is a useful reference. It is not a runtime provenance attestation. See CHROMIUM-LICENSE.txt for adapted data licensing.

The owner supplied an older Chromium dom_us_layout_data.h excerpt as context. The implementation uses the independently fetched pinned reference above rather than trusting the pasted file as execution evidence.

Prior investigation: [Joe Rutkowski, Browser Nerds, Keyboard Layout Fingerprinting](https://browsernerds.com/fingerprints/keyboard-layout/). Its published US edge-key observations motivate the platform profiles: section sign for macOS, backslash for Windows, and less-than for Linux, with ChromeOS expected from its XKB data path. These are layout-dependent profiles, not universal platform markers. No Browser Nerds JavaScript was copied. ScrapeTrace compares all 47 regular positions and requires the expected 48-key shape before considering a platform profile; fallback detection compares the exact full 49-entry map.

API contract: [Keyboard Map specification](https://wicg.github.io/keyboard-map/) and [MDN getLayoutMap](https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/getLayoutMap). Availability, secure contexts, denied calls, empty maps and errors are separate observations. The keyboard map does not reveal physical key presence or keystrokes.

Runtime validation is described in the repository README and scripts/verify-keyboard.mjs. Synthetic controls are functional tests, not measurements of providers. Native headed/headless runs are individual local tool validations; they do not establish universal behavior across versions, toolkits, operating systems or configurations.
