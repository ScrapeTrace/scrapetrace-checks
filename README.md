# ScrapeTrace Checks

Browser diagnostics by [ScrapeTrace](https://scrapetrace.com/) for inspecting what a browser or scraping provider reports through JavaScript.

**Open the checks:** [scrapetrace-checks.pages.dev](https://scrapetrace-checks.pages.dev/)

## Available checks

| Page | What it shows |
| --- | --- |
| [/shader-cache](https://scrapetrace-checks.pages.dev/shader-cache) | Plants a controlled marker in WebGL compilation state and attempts recovery in a separate browser context, with calibration and integrity checks. |
| [/consistency](https://scrapetrace-checks.pages.dev/consistency) | Compares User-Agents across the page, an iframe, and dedicated, shared and service workers. Shows a headless notice when a returned string contains that marker. |
| [/consistency/full](https://scrapetrace-checks.pages.dev/consistency/full) | Compares navigator properties and API availability across the same five contexts, including platform, languages and hardware concurrency. |
| [/screen](https://scrapetrace-checks.pages.dev/screen) | Visualizes screen, available screen area, window and page dimensions, plus visual viewport differences and reported positioning. |
| [/mobile](https://scrapetrace-checks.pages.dev/mobile) | Compares screen geometry, touch and pointer capabilities, User-Agent, platform and mobile client hints. Also compares document request headers with JavaScript readings. |
| [/speech](https://scrapetrace-checks.pages.dev/speech) | Inspects speech synthesis interfaces, voice loading, repeated reads, page/frame consistency and a click-to-test utterance. |
| [/ai](https://scrapetrace-checks.pages.dev/ai) | Checks seven built-in AI interfaces, availability, sample responses and session behavior using ready models. |
| [/keyboard](https://scrapetrace-checks.pages.dev/keyboard) | Displays the keyboard layout map and compares every entry with the Chromium US fallback map. Highlights international keys and missing positions. |
| [/battery](https://scrapetrace-checks.pages.dev/battery) | Observes Battery Status API readings and changes over a sampling window. |
| [/battery/workload](https://scrapetrace-checks.pages.dev/battery/workload) | Records battery readings during baseline, bounded CPU and WebGL work, and recovery phases. |
| [/environment](https://scrapetrace-checks.pages.dev/environment) | Reports browser environment and exposed capabilities. |
| [/incognito](https://scrapetrace-checks.pages.dev/incognito) | Runs an IndexedDB strict-versus-relaxed durability timing experiment after clicking **Run experiment**. |

The checks report exposed values and differences. Headless strings, fallback maps, geometry and timing patterns are observations, not standalone proof of browser mode or physical hardware. The screen diagram is schematic: it cannot identify individual browser bars or reliably locate a window when the browser omits screen origins.

## Use with a scraping provider

Enable JavaScript rendering and request the check URL. For a mobile comparison, collect separate desktop and mobile runs with the provider's corresponding settings. Save the completed rendered HTML or download JSON from the page, together with the request options.

A plain HTTP fetch returns the initial page, not browser measurements. For automation, use the completion signals below rather than assuming the first HTML response contains results.

### Completion signals

For the shader-cache, speech, AI, consistency, screen, mobile, keyboard, battery and environment checks, wait for:

```js
await page.waitForSelector('#probe-complete[data-status="complete"]');
const result = await page.evaluate(() => window.__PROBE_RESULT__);
```

The pages also expose `window.__PROBE_READY__`, `html[data-probe-ready="true"]` and the `probe:ready` document event. Completion can include an explicit unsupported, failed or timed-out result; inspect the reported status.

- **Shader cache:** manual by default. Use the page-generated planter and blind-reader URLs for automatic provider runs. Run the planter first, then the reader in a new context. Allow up to 30 seconds and inspect the result status; a completed run may be inconclusive, unsupported or invalid. Reading warms both candidates. New independent tests need a fresh namespace or bank.
- **Built-in AI:** runs asynchronously and tries only APIs whose `availability()` returns `available`. Navigation load alone is insufficient. Allow at least 75 seconds for the completion marker. No session is started for downloadable, downloading, unavailable or unknown states. The page has per-API click retries, a Stop button, sample output and local JSON export.
- **Consistency:** collection is asynchronous across five contexts, so navigation load alone is insufficient. Each context has a 10-second deadline. Full mode inventories properties and passive getter values; it does not invoke the methods it lists.
- **Screen:** readings update live on resize and window movement. Use **Freeze readings** to retain a snapshot, or read the result immediately after completion.
- **Mobile:** the first result is rendered before navigation load. Reruns refresh JavaScript readings while retaining the original document request headers; reload to capture new request headers.
- **Keyboard:** the API has a five-second deadline and a completion gate renders the first result before navigation load. Unsupported or denied APIs remain explicit outcomes. It reads the layout map, not typed keys.
- **Battery and environment:** navigation load is gated until observation finishes. Passive battery sampling defaults to 12 seconds; environment sampling defaults to two seconds. Allow the observation window plus at least 10 seconds for navigation. See [the legacy tool guide](legacy/README.md) for duration options and workload timing.
- **IndexedDB:** click **Run experiment**, then await `window.__ST005_RESULT__?.complete`. This experiment uses its own result contract and does not start automatically. The [console script](scripts/console.js) is another entry point.

Browser readings remain in tab memory and JSON downloads are local. No readings are uploaded to a collection service. Normal hosting requests, document request header inspection and temporary completion-gate requests still occur.

## Build

Node.js 24 was used for development. The build itself needs no installed packages:

```sh
npm run build
```

The output is `dist/`, containing a self-contained Cloudflare Pages advanced-mode Worker and its routing file. The build combines the current check pages, shared styles and assets, and the preserved battery/environment implementation.

For a Git-connected Pages build, use no framework preset, `npm run build` as the build command, and `dist` as the output directory. Runtime credentials, databases and environment variables are not required by the checks.

## Verification

Browser verification uses Puppeteer Core and an installed Chrome. Install the development dependency, build, then run the relevant checks:

```sh
npm install
npm run build
CHROME_PATH=/usr/bin/google-chrome npm test
CHROME_PATH=/usr/bin/google-chrome npm run test:consistency
CHROME_PATH=/usr/bin/google-chrome npm run test:screen
CHROME_PATH=/usr/bin/google-chrome npm run test:mobile
CHROME_PATH=/usr/bin/google-chrome npm run test:keyboard
npm run test:ai
npm run test:speech
npm run test:shader-cache
HEADED=1 CHROME_PATH=/opt/google/chrome/chrome npm run test:shader-cache:browser
```

Set `PUPPETEER_MODULE` to an existing Puppeteer Core ESM entry point if using an installation outside this repository. Browser verification includes controlled fixtures; these are functional tests, not provider measurements. Retained keyboard verification is in [verification/keyboard-layout-2026-11-03.json](verification/keyboard-layout-2026-11-03.json).

The AI check covers LanguageModel, Summarizer, Writer, Rewriter, Proofreader, LanguageDetector and Translator with English samples (English-to-French translation). It separates property exposure, availability and a successful session response. Small receiver, abort and destroyed-session checks are recorded separately. At most two sessions run together, with three-second availability, 20-second functional and 65-second overall deadlines. Timeouts, missing methods, unexpected output, activation restrictions and cleanup errors remain explicit. This checks public APIs, not local model directories. Functional success does not identify a native implementation. Sources are in [site/ai/SOURCES.md](site/ai/SOURCES.md).

`npm run test:ai` verifies controlled collector cases and built Worker routing without starting a browser or downloading models. Local Chrome 157 also completed real LanguageModel, Summarizer and LanguageDetector calls on 5 November 2026. Results and browser/UI checks are recorded in [verification/built-in-ai-2026-11-05.json](verification/built-in-ai-2026-11-05.json). No provider calls were made.

`npm run measure` runs the separate IndexedDB reproduction study, including headed browser runs that require a graphical display. Its methodology and recorded evidence are documented in [research/REPORT.md](research/REPORT.md).

## Repository layout

- `site/`: current check interfaces, collectors, shared branding and local assets.
- `scripts/`: build, local server adapter, browser verification and IndexedDB reproduction tools.
- `legacy/`: preserved battery/environment implementation and its original guide.
- `dist/`: generated deployment output, ignored by Git.
- `verification/`: retained functional verification records.
- `research/`: existing IndexedDB study notes and methodology.
- `raw/`: recorded study data and reference material.
- `recovery/`: source manifests and original recovery records.

Source provenance and third-party notices are retained beside their implementations, including [keyboard source notes](site/keyboard/SOURCES.md).

## License

New code is MIT licensed. Adapted code retains its upstream copyright and permission notices. Chromium reference data retains its [BSD notice](site/keyboard/CHROMIUM-LICENSE.txt); additional retained Chromium material is covered by [raw/CHROMIUM-LICENSE](raw/CHROMIUM-LICENSE). The locally hosted Inter font uses the [SIL Open Font License](site/shared/INTER-LICENSE.txt).

## Speech and voice observations

`/speech` separates API exposure, returned voices and optional utterance execution. Silent three-second collection records delayed loading, voice metadata, repeated reads and a fresh same-origin frame comparison. The voice table is searchable. Test voice runs only after a click, records start/end/error events and leaves an already busy queue alone. JSON and rendered HTML retain the readings. See [speech source notes](site/speech/SOURCES.md).

Current speech verification is retained in [verification/speech-2026-11-06.json](verification/speech-2026-11-06.json), including native voice loading, page/frame comparison, a completed manual utterance, the unsupported-interface fixture and mobile layout review.

## Shader-cache marker check

`/shader-cache` has explicit planter and reader roles. Choose a namespace, bank 0–63 and eight-hex-character marker. Plant first, then open the generated reader URL in another context or browser/provider session. The reader URL carries namespace and bank only. It receives no expected marker. A successful read requires a matching 32-bit integrity tag and no tied candidate timings.

For automation, use JavaScript rendering and these URL parameters:

```text
/shader-cache?mode=plant&namespace=YOUR_RANDOM_TEST_NAMESPACE&bank=0&marker=89ABCDEF&autorun=1
/shader-cache?mode=read&namespace=YOUR_RANDOM_TEST_NAMESPACE&bank=0&autorun=1
```

Wait for `#probe-complete[data-status="complete"]` and inspect `window.__PROBE_RESULT__`. `planted` confirms the writer workload completed. `recovered` means a candidate passed the integrity check. Other outcomes include `no-valid-record`, `inconclusive`, `unsupported`, `invalid-input`, `cancelled` and `error`. A reader URL containing `marker` is rejected. No automatic visitor ID, generation scan or marker renewal is used. Use random test payloads rather than personal information in URLs.

Readings and program timing/draw records are available in page JSON and a local download. They are not uploaded to a result service. The hosting service still sees URL requests. Reading compiles both candidates and consumes the contrast; each independent test needs a fresh bank/namespace. Concurrent requests against the same bank can affect one another. A failed read can also reflect routing to another worker or graphics stack, so it is not a universal provider-isolation verdict.

Local verification on 7 November 2026: three fresh-context readers recovered the planted marker exactly; all three destructive rereads, three unwritten controls and three new-profile/new-process controls returned no valid marker. One headed Chrome 157/Linux/AMD setup, no provider calls. [Functional verification](verification/shader-cache-2026-11-07.json) distinguishes these trials from UI tests. See [source and protocol notes](site/shader-cache/SOURCES.md). These observations do not locate the physical cache layer.
