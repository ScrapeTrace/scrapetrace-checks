# ST—005: IndexedDB durability timing and private-context inference

Research date: 27 October 2026 (Asia/Kolkata). This is an independent investigation and reusable tool implementation, not a finished blog post.

The mechanism comes from **Joe Rutkowski’s [detectIncognito.js](https://github.com/Joe12387/detectIncognito)**, under MIT. Its source is retained with its license and attributed in our adapted timing implementation. ST—005’s original work is testing validity, implementation/backend context, filesystem effects, transparent measurements and reproducibility.

## Finding

On this one Linux host, Chrome 154’s disk-backed default contexts and nondefault contexts separated strongly at the upstream 1.30 threshold. Persistent normal contexts whose profiles lived on **tmpfs** did not: every such run was classified private-like. Consequently, low strict/relaxed separation cannot prove private mode. We measured transaction completion latency; we did not measure hardware flushes or verify physical storage residency.

Manual Chrome console tests and provider comparisons are deliberately pending. The user specifically reserved those tasks for themselves. No JavaScript was executed through the personal Chrome console. Puppeteer measurements use separate task-owned Chrome processes and profiles.

## Chromium engineering evidence: proposed, implemented, and observed

1. **Landed flag, 23 October 2025.** [Commit c26da1d](https://chromium.googlesource.com/chromium/src/+/c26da1deddc92a2f4ffb5594830cd1d9c01dbe8a%5E%21/) introduced `IdbSqliteBackingStoreInMemoryContexts`, disabled in source defaults but enabled in test variation configuration. This is implementation/test evidence, not proof of public rollout percentages.
2. **Engineering discussion, 9–15 December 2025.** The [blink-dev PSA](https://groups.google.com/a/chromium.org/g/blink-dev/c/jEDGJfRibfM) targeted Chrome 144 for in-memory SQLite, with persisted migration deferred. Engineers discussed an observable transaction-scheduling difference, imperfect A/B detection, and possible mitigations. Those mitigation ideas are proposals in the thread, not verified deployment settings. They also acknowledged performance differences and sensitivity to device/load. Their scheduling demo is a different technique from the durability ratio tested here. The authors’ Microsoft affiliations appear in the discussion; it should not be described as a Google-authored validation of the exact 1.30 durability algorithm.
3. **Chrome Status is not a universal rollout certificate.** The [feature entry](https://chromestatus.com/feature/5126896685809664) and its [JSON API](https://chromestatus.com/api/v0/features/5126896685809664), saved locally, currently report `browsers.chrome.status.text = Proposed`, `is_released = false`, and desktop/Android milestone **145**; a developer-trial stage lists 144. Last metadata update is 21 January 2026. This differs from the original PSA estimate. It does not establish what percentage of installed browsers use either backend today.
4. **Version-matched source is stronger implementation evidence.** In [Chrome 154.0.8037.57 `bucket_context.cc`](https://chromium.googlesource.com/chromium/src/+/154.0.8037.57/content/browser/indexed_db/instance/bucket_context.cc#190), `GetSqliteRolloutStage` returns SQLite-only for in-memory contexts after test/force overrides. Normal on-disk selection can follow `IdbSqliteOnDiskRollout` and its stage; otherwise it selects LevelDB. This is no longer the 2025 flag-only code. The [feature defaults](https://chromium.googlesource.com/chromium/src/+/154.0.8037.57/content/public/common/content_features.cc#539) leave force-SQLite and on-disk rollout disabled by default; field trials may override defaults.
5. **SQLite durability behavior is implemented.** [Chrome 154 `database_connection.cc`](https://chromium.googlesource.com/chromium/src/+/154.0.8037.57/content/browser/indexed_db/instance/sqlite/database_connection.cc) uses `OpenInMemory()` for in-memory contexts, and sets `PRAGMA synchronous=FULL` for strict transactions versus `NORMAL` otherwise before transaction begin. This explains why backend changes merit revalidation, but a measured ratio does not identify the backend by itself. The versioned snapshots are retained under `raw/chrome154-*`.
6. **Current main corroborates implementation, not every installed browser.** Main was observed at [1c1572d42c56acede0482fd402a9a91cf6d6aef5](https://chromium.googlesource.com/chromium/src/+/1c1572d42c56acede0482fd402a9a91cf6d6aef5). The fetched main sources likewise select SQLite for in-memory contexts. Main snapshots were fetched through the moving main ref during that session; use the version-matched 154 snapshots for reproducibility.
7. **Tracking issue visibility limitation.** [Issue 436880911](https://issues.chromium.org/issues/436880911) returned a sign-in-only shell in this environment. Its current resolution, rollout percentages, and private comments were not verified. The thread, source and feature metadata are the available primary evidence; do not invent an issue resolution.

The [IndexedDB durability specification](https://w3c.github.io/IndexedDB/#enumdef-idbtransactiondurability) distinguishes persistence confidence for strict and relaxed transactions; it does not expose a physical `fsync` measurement API. Timing includes browser task scheduling, IPC, serialization, transaction bookkeeping and storage work. Filesystems, caches, virtualization, power-loss guarantees and timer precision matter. Recognizing `tx.durability` is an API check, not hardware attestation. In-memory backing also does not establish that process memory can never be swapped or copied elsewhere by the OS.

## Exact upstream technique inspected

Pinned source: [commit 04d041218058d201c811b68b551a0e46108747a5](https://github.com/Joe12387/detectIncognito/blob/04d041218058d201c811b68b551a0e46108747a5/src/detectIncognito.ts). The file header says v1.8.1 while that commit’s package change is v1.9.0; pin the commit rather than relying on the header alone. [MIT license](https://github.com/Joe12387/detectIncognito/blob/04d041218058d201c811b68b551a0e46108747a5/LICENSE).

- Chromium branch uses one randomized temporary IndexedDB database and store `s`.
- Zero-filled `Uint8Array(16384)` payload; fifteen sequential single-put transactions per block, each advancing from `oncomplete`. Keys 0–14 are overwritten in successive blocks.
- Probe `durability: strict`, check `tx.durability === strict`, then abort the probe. The source does not verify a physical flush.
- One relaxed block, then one strict block warm up; those samples are discarded.
- Up to fifteen measured rounds, always at least seven. Each round is relaxed first, then strict. Stop after a complete round if at least seven exist and the soft 1000 ms budget (including warmups) has elapsed. This is not a hard one-second deadline; a slow block can exceed it.
- Each round contributes strict elapsed / relaxed elapsed, with nonpositive relaxed time treated as Infinity. Sort ratios and choose index `length >> 1`: the upper median for even counts. Classify private when **ratio < 1.30**, so equality is not private.
- Unsupported hints, open errors and asynchronous measurement errors return `isPrivate: false`. A synchronous open exception or an unrecognized browser can reject through the outer async error path. A false return is therefore not proof of a regular window. The upstream source closes and requests database deletion, but does not await deletion completion or report blocked cleanup.
- Comments claim device calibration and assume LevelDB memenv. These are upstream assertions, not calibration independently reproduced here. Our browser version uses SQLite-selection code for in-memory contexts; this study therefore tests behavior beyond that comment’s stated premise.

Our implementation preserves the constants, sequential callback structure, warmup/order and upper-median decision, while adding per-commit/per-block samples, bounded failures, recognized strict **and relaxed** checks, awaited cleanup, visibility reporting, inconclusive outcomes, and an optional alternating-order sensitivity series. Instrumentation adds some overhead; it is a research adaptation, not byte-identical upstream execution. It reports the heuristic separately from truth and never sets an asserted private-mode boolean.

## Real measurements

Environment: Linux x64, kernel 7.0.0-38-generic, AMD Ryzen AI 9 HX PRO 370, 24 logical CPUs, approximately 32.8 GB RAM; Chrome **154.0.8037.57**, Puppeteer Core **24.43.1**. Full launch arguments are in each JSON dataset. No force-IDB-backend flag or `--no-sandbox` was added. Ordinary Puppeteer automation flags are present and recorded.

Profiles were newly created for this study. For each headed/headless process, a normal/default-context storage sentinel survived a full Chrome close/relaunch. The nondefault context did not share that sentinel. Puppeteer-created nondefault Chrome contexts are the incognito-like comparison; this does not substitute for the user’s manually observed normal/Incognito windows. Normal profile IndexedDB directories contained `.indexeddb.leveldb` files, recorded before profile removal. The private backend was not traced at runtime; source selection plus context construction support interpretation without making the timing itself proof of SQLite.

The workspace profile filesystem is `/dev/mapper/crypt-home`, **btrfs**. `/tmp` is **tmpfs**. The controlled datasets were collected sequentially after verification completed. Each filesystem has 20 upstream-order and 10 alternating-order runs for each context/headless combination: **240 primary/sensitivity runs** overall. Additional UI runs are stored separately. An earlier tmpfs exploratory dataset is retained and excluded from the table; its first portion overlapped local QA briefly.

The table uses the ordinary statistical median across run-level upper medians. UI aggregate medians use the upper-median convention. Raw samples allow either to be recomputed.

| Profile filesystem | Chrome | Context | n | Median ratio | Range | Below 1.30 |
|---|---|---|---:|---:|---:|---:|
| disk | headed | persistent-default | 20 | 31.0158 | 20.9565–39.5185 | 0 |
| disk | headed | nonpersistent-context | 20 | 1.0000 | 0.9167–1.0714 | 20 |
| disk | headless | persistent-default | 20 | 29.8194 | 22.3529–33.8333 | 0 |
| disk | headless | nonpersistent-context | 20 | 1.0000 | 0.8889–1.1429 | 20 |
| tmpfs | headed | persistent-default | 20 | 1.0000 | 0.8636–1.0556 | 20 |
| tmpfs | headed | nonpersistent-context | 20 | 1.0000 | 0.9231–1.1111 | 20 |
| tmpfs | headless | persistent-default | 20 | 1.0000 | 0.8966–1.1818 | 20 |
| tmpfs | headless | nonpersistent-context | 20 | 1.0000 | 0.9091–1.0909 | 20 |

Interpreted as a private-mode classifier, the disk-backed upstream-order sample has **0/40 false positives** among normal contexts and **0/40 false negatives** among nondefault contexts. The tmpfs sample has **40/40 false positives** among normal contexts and **0/40 false negatives** among nondefault contexts. These are observed counts on one host/version, not population accuracy estimates. Repeats in one process are correlated. The alternating-order sensitivity results are in `raw/summary.csv`; they do not fix the tmpfs false positives.

Example actual individual runs (full samples in JSON): the first headed disk-backed normal run and the first headed nondefault run are reproduced in `raw/examples.json`. Their labels are controlled-context labels, not invented human console transcripts.

The profile-filesystem manipulation is consistent with a storage-latency explanation; it does not isolate each contributor or prove a hardware `fsync` occurred. A default context can be persistent across restarts and still have a profile on a RAM filesystem. Therefore **persistent, private, in-memory backend, and RAM-backed filesystem are different properties**. Neither a private-like ratio nor a real Incognito context is evidence that a browser is a bot. Automation can use persistent profiles; humans can use private windows.

## Implemented tools and preservation

- `scripts/console.js`: self-contained, no external imports or network requests, full attribution/license, raw samples and cleanup status. The user will run it manually.
- `/incognito`: click-to-run UI; repeated experiments, strict/relaxed block medians, median ratio, mixed outcomes, recognized browser/version string, detailed raw transaction timings, local JSON export, cleanup status and caveats. No analytics or measurement upload. JSON exports deliberately contain self-reported environment fields so the user can review before sharing.
- `scripts/puppeteer.mjs`: reproducible headed/headless default/nondefault context runs, profile filesystem recording, browser flags, restart/isolation checks and screenshots; own profiles removed in finally.
- Build/test scripts, full raw datasets, CSV/JSON summaries and screenshots retained.
- Existing `/battery`, `/battery/workload`, `/environment`, their completion gates, and Worker remain delegated unchanged. Source and original deployed Worker copied from the user-provided directory. Checksums in `recovery/legacy-source-manifest.json` establish what was recovered. Original files were not modified.

Verification: **19 checks passed** in `raw/verification.json`: legacy route response/body equivalence (normalizing generated run UUIDs), real transactions and commit sample counts, no auto-execution, unsupported API abstention, unrecognized durability abstention, controlled write failure, database cleanup, mobile fit, no page errors, and real battery load completion. Desktop/mobile UI captures were visually inspected. No test-created database remained in the tested origin.

## Publication, deployment and remaining work

GitHub target is `ScrapeTrace/scrapetrace-checks`. The stored GitHub account was verified as an active ScrapeTrace organization admin before mutation. The connected GitHub plugin did not expose that org/repository access, so the existing local Git credential was used for permission checks and repository publication. No credential values are stored in artifacts.

Cloudflare target is the existing project `scrapetrace-checks` (ID `8958ef0b-336e-4f96-b239-66fda7fffe79`) in account `74dd9702bb66bbf734ff1088fd2955ed`. The original canonical deployment was `351dcd59-bf3f-4a6f-a844-d7e92a4e3883`. Preview `27373db7-a4a1-48d8-99a4-72d96c14a0cc` deployed successfully before production. See `recovery/deployment.json` for final IDs/URLs and verification. Existing Direct Upload architecture is preserved; GitHub publication does not automatically enable deployment on push.

Pending user evidence: manual normal/Incognito console runs, other Chrome versions/platforms, broader hardware/filesystem coverage, and any provider comparisons. No named provider observations or comparative conclusions were published. The user reserved provider testing. Future evidence must retain exact provider configuration, completion/JS execution evidence, multiple observations, raw exports, screenshots and failures. The UI is manual by default; provider browser workflows must explicitly click Run experiment and wait for completion. Initial HTML is not an experiment result.

The four additional project leads are recorded in `BACKLOG.md` without investigation. `ARTICLE-OUTLINE.md` is a research-based outline only. Cleanup scope and final status are recorded in `CLEANUP.md`.
