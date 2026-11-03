# ScrapeTrace Checks · ST—005

Reusable browser observations at https://scrapetrace-checks.pages.dev/ — existing battery/environment tools plus `/incognito`, an IndexedDB durability timing experiment.

The original timing mechanism is **Joe Rutkowski’s [detectIncognito.js](https://github.com/Joe12387/detectIncognito)**, MIT licensed. ST—005’s contribution is investigating the technique, its validity, backend changes, filesystem/context behavior, transparent reporting, and reproducible comparisons. We do not claim to have discovered the mechanism.

## Run it yourself

Open https://scrapetrace-checks.pages.dev/incognito and select **Run experiment**. It runs locally only after a click. Download raw JSON to retain every block and transaction sample. No browser readings are uploaded. No analytics or third-party assets are used by the new tool.

For the browser console, paste the entire [`scripts/console.js`](scripts/console.js) into a secure page’s console. Inspect the source first. It returns the full result, prints round timings, and awaits removal of its uniquely named database. Run separately in normal and private windows and retain the actual output with your browser version and manually recorded window mode. Console runs in the user’s Chrome were intentionally left to the user. Do not disable console paste protection without reviewing the script.

A ratio below 1.30 means **private-like timing**, not verified private mode. A ratio at or above 1.30 means **normal-like timing**, not verified physical disk flushing. Unsupported APIs, write failures, and hidden tabs are inconclusive. Bot detection is outside this signal’s evidential scope.

## Build and reproduce

Node.js 24 was used. Building needs no dependencies:

```sh
npm run build
```

The self-contained Pages advanced-mode Worker is generated in `dist/`. Legacy behavior delegates to the recovered Worker, with a shared presentation layer matching the main ScrapeTrace publication. All public tool pages use the same charcoal/purple palette, wordmark, locally hosted Inter font, header and footer; collectors and completion gates remain unchanged. The original source and deployed Worker are retained under `legacy/`; source checksums are in `recovery/legacy-source-manifest.json`.

For verification/benchmarks, install Puppeteer Core in your own environment, or set `PUPPETEER_MODULE` to the existing installation’s ESM entry point. The recorded run used Puppeteer Core 24.43.1. No packages or browsers were downloaded for this study.

```sh
npm install
CHROME_PATH=/usr/bin/google-chrome npm test
CHROME_PATH=/usr/bin/google-chrome npm run measure
ST005_LABEL=tmpfs ST005_PROFILE_ROOT=/tmp/st005-reproduction npm run measure
```

`npm run measure` needs a graphical display for its headed portion. It launches **task-owned** Chrome, tests persistent default contexts and nonpersistent contexts, verifies a storage sentinel survives browser restart and remains isolated from the nondefault context, captures headed/headless screenshots, and removes only its own profiles. The default profile root is `.profiles/` within this project; verify the filesystem with `df -T .` before drawing conclusions. The `/tmp` filesystem may be RAM-backed. Each context gets 20 upstream-order runs and 10 alternating-order sensitivity runs by default. Use `ST005_RUNS` and `ST005_SENSITIVITY` to adjust counts. Raw files record Chrome version, full launch flags, host environment, visibility, timings, cleanup, and profile filesystem. `ST005_NO_SANDBOX=1` is an explicit opt-in for environments that require it; it was not used here.

## Structure and evidence

- `site/`: client-side experiment, interface, shared ScrapeTrace branding, local font and logo, attribution/license.
- `scripts/`: build, self-contained console script, local adapter, verification, Puppeteer reproduction, summaries.
- `legacy/`: recovered battery, workload and environment source, read-only in this investigation.
- `research/REPORT.md`: findings, source links, actual measurements, uncertainty and remaining work.
- `research/ARTICLE-OUTLINE.md`: evidence-led outline; no final blog assertions.
- `research/BACKLOG.md`: the four deferred ideas.
- `raw/`: measured samples, screenshots, upstream reference source and Chromium evidence.
- `recovery/`: original checksums, deployment/HTTP preservation evidence.
- `research/CLEANUP.md`: cleanup scope and final status.

The old source was copied from the user-provided `browser-checks` folder. Its historical README describes the original tools. Root-level scripts above are the supported reproduction entry points for this repository.

## Deployment

This is an existing **Direct Upload** Pages project. Build first, then deploy `dist/` to `scrapetrace-checks` using an authorized Pages API/CLI session. Preserve advanced-mode routing and the legacy Worker. Creating this GitHub repository does not automatically connect Direct Upload to Git. Do not replace or recreate the Pages project just to add Git integration.

## Provider observations

None were requested from providers during this study. The user will perform those comparisons. A valid observation must document provider name/version/date, endpoint, all rendering/wait/region/profile options, requested URL, execution evidence, multiple completed results and screenshots, and failures. A provider can click **Run experiment** and wait for `window.__ST005_RESULT__.complete` or the `st005:complete` event. A plain HTTP response or initial HTML contains no measurements. No provider’s actual private mode or bot status follows from the timing label alone.

## License

New code is MIT licensed. Adapted timing code retains the upstream MIT copyright and permission notice. The recovered existing tools are supplied by the ScrapeTrace owner. Inter is distributed under the SIL Open Font License 1.1; its notice is in `site/shared/INTER-LICENSE.txt`. Chromium snapshots retain Chromium copyright notices and are governed by Chromium’s BSD license; see `raw/CHROMIUM-LICENSE`. Public research references are cited, not presented as our original work.

## Cross-context consistency checks

- `/consistency`: automatic User-Agent comparison for the page, a fresh same-origin iframe, and dedicated, shared and service workers. Worker details expand when readings differ or a worker is unavailable. A headless notice appears only when a readable User-Agent contains `headless` (case-insensitive). This describes the string, not verified browser execution mode.
- `/consistency/full`: linked advanced view enumerating own and inherited string-named navigator properties in all five contexts, including User-Agent, hardware concurrency, languages, platform and exposed API objects. It separates value differences, API availability differences, nested snapshot differences and getter errors. WorkerNavigator normally exposes fewer APIs than Navigator; missing APIs are not an authenticity verdict.

Both pages run on load, support reruns and local JSON downloads, and keep readings in tab memory. Full mode reads passive getters and inventories methods without invoking them; it does not request permissions, call device APIs or fetch high-entropy method results. Nested snapshots stop at three levels and 100 entries per object, with truncation markers. Symbol properties, browser internals and method return values are outside the snapshot. Dynamic values may differ during collection.

Each asynchronous context has a 10-second deadline. Unsupported, failed or timed-out contexts are explicit and never treated as matches. Temporary frames and workers are removed or closed; the unique service-worker scope does not control the page and its registration is unregistered after collection. No existing service-worker registration is reused. Registration failures and cleanup failures are retained in JSON.

Automation: wait for `#probe-complete[data-status="complete"]` or `window.__PROBE_RESULT__?.complete`. `window.__PROBE_READY__`, `html[data-probe-ready="true"]` and the `probe:ready` document event also signal completion. These pages collect asynchronously after load, so navigation load alone is insufficient. `window.__PROBE_RESULT__` contains context status, property snapshots, UA comparison and (in full mode) per-property comparisons. An incomplete comparison still completes collection with explicit unavailable contexts.

Implementation: `site/consistency/`, routed by `scripts/build.mjs`. Verify with `npm run build` then `npm run test:consistency` (same installed Chrome/Puppeteer options as the existing tests). Review screenshots and a functional check summary are saved to a fresh temporary directory, or `CONSISTENCY_OUTPUT` when set. These are UI checks, not research measurements. Verified in local Chrome 154 on 3 November 2026, including actual execution in all five contexts, controlled differences, getter failure, unavailable workers, timeout, cleanup, reruns and desktop/mobile layouts. Cross-browser and provider-specific validation remain future work.

## Screen and window geometry

`/screen` reconstructs the reported screen, available screen area, outer window, layout viewport and (only when different) visual viewport in a proportional SVG. It reads `screenX`/`screenY`, outer/inner dimensions, screen/available dimensions and origins, root client dimensions, visual viewport size/offset/scale, scroll offsets and device pixel ratio. It shows derived window margins and nonzero size differences with their formulas, and highlights when screen, window and page dimensions all match.

The outer-to-inner gap is a combined non-page area. The drawing places the whole vertical gap at the top and splits the horizontal gap evenly; this is a schematic placement, not measured browser-bar positions. It cannot distinguish tabs, address/bookmark/info bars, borders, sidebars or docked tools. Screen minus window size does not prove a taskbar; available-screen readings are compared separately. If `screen.left`/`screen.top` are unavailable, origin (0, 0) is explicitly assumed, which can misplace windows on multiple displays. Negative positions and differences remain intact. All dimensions are reported CSS pixels; DPR is separate. Zero, missing, nonfinite or excessive geometry does not produce a misleading diagram. Visual-viewport comparisons use a 0.01 CSS-pixel tolerance and also include offset/scale changes.

Readings run automatically and update on resize, visual viewport events and a one-second visible-tab poll for window movement. Freeze retains a snapshot; refresh reads once even when frozen. JSON downloads are local and no measurements are uploaded. Wait for `#probe-complete[data-status="complete"]` (hidden marker), `window.__PROBE_RESULT__?.complete`, or the `probe:ready` event. The result contains `readings`, derived `analysis`, a timestamp and readiness flags; live updates replace it. These pages do not use the legacy navigation load gate, so load alone is not the measurement contract.

Source: `site/screen/`. Run `npm run build` and `npm run test:screen` to verify the geometry calculations and Chrome browser integration. Review outputs go to a fresh temporary directory, or `SCREEN_OUTPUT`. Controlled screenshots use explicitly synthetic fixtures to test browser UI gaps, available area, coincident dimensions, zoom and reduced mobile visual viewports; they are not observations of scraping providers. Local Chrome 154 verification on 3 November 2026 also covered live resize, negative positions, overflow, missing APIs, invalid dimensions, freeze/resume, JSON export and responsive layouts. Cross-browser/provider validation and exact physical UI identification remain outside this check.

## Mobile configuration check

`/mobile` shows a schematic screen on the left and geometry, input and identity readings plus cross-signal differences on the right. A detailed table below retains every reading. It collects screen/window/visual-viewport dimensions, DPR, navigator UA/platform/touch points/vendor/languages/hardware concurrency/memory/automation disclosure, low-entropy JavaScript UA client hints, and primary/any pointer and hover media queries. It also records the document request’s User-Agent, Sec-CH-UA-Mobile, Sec-CH-UA-Platform and Sec-CH-UA as received by the Pages Worker. Those headers are escaped before embedding; no browser measurements are uploaded. The local preview adapter now forwards incoming headers so previews exercise the same request comparison.

The compact-screen heuristic is a shorter screen edge of at most 600 CSS px. Findings describe compact geometry with desktop-oriented identity, UA/client-hint/mobile/platform differences, incompatible UA/navigator platforms, mobile identity without reported touch, and document-header/JavaScript differences. Android with a Linux navigator platform and iPad desktop-mode combinations are allowed by the platform comparison. Touch plus mouse-style input is contextual, not an automatic failure. Missing UA-CH is unknown, not false. Headless is mentioned only when the JavaScript UA contains that marker. No physical mobile device, provider configuration or authenticity score is inferred.

It executes synchronously after its module dependencies load and completes before document load. For scraper HTML capture, wait for navigation load or `#probe-complete[data-status="complete"]`. The rendered HTML contains visible findings, the complete table and `#report-json`; automation can also read `window.__PROBE_RESULT__`, `window.__PROBE_READY__`, `html[data-probe-ready="true"]` or the `probe:ready` event. Initial HTTP HTML and no-JavaScript visits remain not measured. Reruns replace browser readings but retain the original document request headers; reload for a new request. JSON downloads are local. To compare a provider’s desktop and mobile options, retain separate completed outputs and request settings.

Source: `site/mobile/`. Run `npm run build` and `npm run test:mobile`. Review screenshots and functional verification output are written to a fresh temporary directory, or `MOBILE_OUTPUT`. Local Chrome 154 verification on 3 November 2026 covers the user-described partial-mobile pattern using a synthetic fixture, coherent Android signals, iPad desktop mode, unknown/missing APIs, request/JS disagreement, escaped request headers, rendered HTML at navigation load, reruns and desktop/mobile layouts. These fixtures are not new ScraperAPI or mrScraper measurements. No provider calls were made; cross-browser/provider testing remains open.

## Keyboard layout check

`/keyboard` automatically reads `navigator.keyboard.getLayoutMap()` and renders the 50 writing-system positions, with international keys highlighted and absent keys dashed. It shows total/known key counts, a six-key top-row family label, Backquote and international-key values, browser platform claims, an exact Chromium US fallback comparison, and a complete map/reference table. JSON exports and rendered HTML retain the actual entries and collection status. No keystrokes, keyboard lock or typing events are collected; browser readings are not uploaded.

The reference is Chromium `152.0.7977.82`, documented with source URLs and hashes in `site/keyboard/SOURCES.md`, with its BSD notice in `site/keyboard/CHROMIUM-LICENSE.txt`. Browser Nerds / Joe Rutkowski is credited for the prior investigation and its layout-dependent US platform examples. ScrapeTrace independently implements the interface and comparison logic. Fallback matching requires exactly the 49 expected entries and every value, not just the key count or a yen key. Platform profiles require all 47 regular US positions plus the expected 48-key shape without IntlYen/IntlRo. UK, ABNT-like, JIS-like, modified and incomplete controls abstain from unsupported platform inference. A fallback match leaves native origin and compatibility unknown; it is not proof of headless mode. Native-code markers and returned-object names are diagnostic only.

API absence, insecure context, missing method, rejection/denial, empty map, timeout, invalid return and usable maps are distinct outcomes. The API deadline is five seconds. A classic parser-blocking completion script waits 5.5 seconds so the initial result, or a terminal timeout, is rendered before navigation load. Three temporary same-origin streaming requests prevent networkidle0/networkidle2 from returning before load and completion; they are aborted afterward, with a server safety deadline. No measurement data travels in those requests. For HTML capture, wait for load or `#probe-complete[data-status="complete"]`. `window.__PROBE_RESULT__`, `window.__PROBE_READY__`, `html[data-probe-ready="true"]`, the `probe:ready` event and `#report-json` expose the completed snapshot, including terminal unavailable outcomes. Reruns replace it and should be awaited via the marker/readiness flags. Initial HTTP HTML and no-JavaScript visits remain unmeasured.

Build and test with `npm run build` and `npm run test:keyboard`. Review files go to a fresh temporary directory or `KEYBOARD_OUTPUT`. Functional validation includes synthetic layout controls and missing/denied/empty/timed-out APIs, safe rendering, navigation-load and networkidle2 capture, no-JavaScript behavior, reruns, and desktop/mobile layout. Separately labelled local Chrome 154 headed and headless calls on 3 November 2026 returned 48 and 49 entries respectively, the latter matching the reference exactly. The final functional check summary and these two native results are retained in `verification/keyboard-layout-2026-11-03.json`. These are individual local UI validations, not provider observations or a benchmark. No provider calls were made. Cross-browser/version/toolkit coverage remains open.
