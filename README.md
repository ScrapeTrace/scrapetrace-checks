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
