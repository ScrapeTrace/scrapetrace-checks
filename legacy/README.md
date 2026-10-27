# ScrapeTrace Browser Checks

General check hub at `/`, battery observations at `/battery`, environment report at `/environment`.

## Automation contract

Use a JavaScript-capable browser and wait for navigation **load**, then read `window.__PROBE_RESULT__` or parse `#report-json`. Do not use a response-only/commit wait. No selector wait is needed after load. Alternatively, wait for the visible `#probe-complete` selector. It is inserted only after the full document load event and a completed observation, including terminal unsupported/timeout outcomes. It is absent while collecting, with JavaScript disabled, or when the collector fails. It has `data-status="complete"`. The result is also exposed through `window.__PROBE_READY__`, a `probe:ready` document event, and `html[data-probe-ready="true"]`.

The Pages Worker serves an immediate document with a classic parser-blocking external finalizer (`/api/completion-gate.js`). That request stays pending for the observation window plus 3.5 seconds. Its script synchronously renders the final report before parsing can finish, so both DOMContentLoaded and load wait for results.

Three ordinary fetch requests to `/api/network-gate` start as soon as the collector runs. Their response bodies remain open until the browser cancels them **after both the load event and report completion**. Three requests keep both networkidle0 and networkidle2 busy. These fetches do not block load, avoiding a circular dependency. Aborted requests at completion are expected, not failures. Server streams also have a bounded safety deadline (observation allowance plus 15 seconds) and clean up on disconnect. No per-run database, cross-request state or browser readings are sent to the server.

The visible `#probe-complete` marker remains the explicit completion contract. Use `load`, `domcontentloaded`, `networkidle0`, `networkidle2`, or the marker with a sufficiently long timeout. A provider which ignores navigation waits, disables JavaScript, blocks the gate endpoints, enforces an earlier timeout, or returns initial HTTP HTML can still return an incomplete page.

Default battery observation: 12 seconds, plus a 3.5-second acquisition/finalization allowance. Environment: 2 seconds plus allowance. `?seconds=60` selects a longer observation. User-supplied windows clamp to 5–120 seconds. Set browser navigation timeout above the selected window plus 10 seconds. Network failure or external browser cancellation can still abort navigation; that is not a completed test.

Only the built-in test pages are gated. The tool hub loads immediately. HTTP-only clients receive no measured battery report. No-JavaScript browsers explicitly show not-executed. CSP or script failures cannot produce a successful hardware conclusion.

## Interpretation

Physical battery presence is never verified. Outcomes distinguish suspicious API contradictions, observed discharge behavior, and inconclusive authenticity. Even a changing, consistent battery can be spoofed. An unchanged discharging level is inconclusive because of rounding, estimation and the short observation. No stress workload runs. Automation disclosure does not mean emulator detection.

Browser readings remain in tab memory; JSON exports are local. Normal Cloudflare hosting requests still occur. No readings are posted to a server, and no analytics or third-party assets are used.

Sources: https://www.w3.org/TR/battery-status/ and https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getBattery and https://developer.mozilla.org/en-US/docs/Web/API/Navigator/webdriver

## Build and verification

Run `node build.mjs`. Deploy `dist/` as a Cloudflare Pages advanced-mode project. No environment variables, database or credentials are needed at runtime.

`node tests/browser.mjs` uses the existing sibling fingerprint-prober Playwright dependency and installed Chrome. It starts a temporary local adapter, tests real and controlled battery cases, captures desktop/mobile screenshots, verifies results exist in the load listener, and tests export, no-JS and unsupported/timeout handling. `TEST_BASE_URL` can target a deployed site instead.

The generated `dist/_worker.js` is self-contained and includes the HTML, styles and collector. `dist/_routes.json` directs all requests through the Worker.

## Separate workload endpoint

`/battery/workload` runs automatically with 30 seconds baseline, 30 seconds bounded CPU + WebGL work, and 30 seconds recovery (about 94 seconds including finalization). Configure a navigation/selector timeout of at least 110 seconds. `?phaseSeconds=5` gives a shorter 5/5/5-second diagnostic run; phase durations clamp to 5–30 seconds. The passive `/battery` endpoint does not create workloads.

The CPU workload uses one Worker, targeting 20 ms busy / 30 ms idle batches. The GPU workload submits a 256×256 shader up to 30 fps. Counts, a checksum, renderer strings and final pixel readback are recorded. GPU execution may use software rendering. These are bounded execution observations, not power measurements or proof of physical hardware.

The report includes phase-tagged battery samples, actual phase boundaries, CPU/GPU execution statistics, and per-phase level deltas and runtime-estimate change counts. It makes no causal or authenticity claim. Unsupported hardware is explicit. Stop and hiding the page end active work immediately; passive sampling and the navigation gate continue until the scheduled end. Interrupted runs are labelled incomplete.

`node tests/workload.mjs` verifies execution, phases, stop, unsupported CPU/GPU and completion gates. `TEST_FULL_WORKLOAD=1 TEST_BASE_URL=https://scrapetrace-checks.pages.dev node tests/workload.mjs` verifies the full default 90-second experiment on the deployment.
