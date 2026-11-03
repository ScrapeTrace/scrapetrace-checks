# ScrapeTrace Checks

Browser diagnostics by [ScrapeTrace](https://scrapetrace.com/) for inspecting what a browser or scraping provider reports through JavaScript.

**Open the checks:** [scrapetrace-checks.pages.dev](https://scrapetrace-checks.pages.dev/)

## Available checks

| Page | What it shows |
| --- | --- |
| [/consistency](https://scrapetrace-checks.pages.dev/consistency) | Compares User-Agents across the page, an iframe, and dedicated, shared and service workers. Shows a headless notice when a returned string contains that marker. |
| [/consistency/full](https://scrapetrace-checks.pages.dev/consistency/full) | Compares navigator properties and API availability across the same five contexts, including platform, languages and hardware concurrency. |
| [/screen](https://scrapetrace-checks.pages.dev/screen) | Visualizes screen, available screen area, window and page dimensions, plus visual viewport differences and reported positioning. |
| [/mobile](https://scrapetrace-checks.pages.dev/mobile) | Compares screen geometry, touch and pointer capabilities, User-Agent, platform and mobile client hints. Also compares document request headers with JavaScript readings. |
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

For the consistency, screen, mobile, keyboard, battery and environment checks, wait for:

```js
await page.waitForSelector('#probe-complete[data-status="complete"]');
const result = await page.evaluate(() => window.__PROBE_RESULT__);
```

The pages also expose `window.__PROBE_READY__`, `html[data-probe-ready="true"]` and the `probe:ready` document event. Completion can include an explicit unsupported, failed or timed-out result; inspect the reported status.

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
```

Set `PUPPETEER_MODULE` to an existing Puppeteer Core ESM entry point if using an installation outside this repository. Browser verification includes controlled fixtures; these are functional tests, not provider measurements. Retained keyboard verification is in [verification/keyboard-layout-2026-11-03.json](verification/keyboard-layout-2026-11-03.json).

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
