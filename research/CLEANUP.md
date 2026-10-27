# ST—005 cleanup manifest

Pre-existing user profiles, Chrome installations, dependency directories, battery source, and deployment are never cleanup targets.

- `/tmp/st005-research`: task-created retrieval scratch; remove at completion.
- `/tmp/st005-profile-*`: runner-created profiles; remove in runner finally after browser close.
- `st-005/dist`: generated final deployable artifact, retained.
- `st-005/raw`, `st-005/recovery`, `st-005/legacy`, `st-005/scripts`, `st-005/research`, `st-005/site`: final reproduction/source/evidence artifacts, retained.
- No test containers or images created. Existing Puppeteer dependency and browsers reused read-only.

Runtime databases use the unique `__st005_` prefix. Each invocation closes its connection and awaits deletion, recording success or failure. A tab/process crash can prevent cleanup; use site-data controls for the experiment origin. Never delete unrelated IndexedDB databases.

## Completed

All task-owned browser processes were closed and their profiles removed by the runners. Final filesystem check found no `/tmp/st005-profile-*` profiles. The empty workspace `.profiles/` root was removed. `/tmp/st005-research` (retrieval scratch, downloaded check pages, protocol diagnostic, temporary build copy and CLI log) was removed. No browsers, packages, images or containers were downloaded/installed/created. All measured databases reported deletion. Existing user browsers, caches, dependencies, source and the old production deployment were preserved. The temporary preview deployment was removed after successful production verification; its evidence/ID are retained.

Final retained artifacts: source, deployed build, raw measured JSON/logs/screenshots, relevant licensed source snapshots, report/outline/backlog, and deployment/recovery/cleanup manifests. The 120-run preliminary tmpfs dataset is explicitly marked exploratory and excluded from primary results. A clean Git archive rebuilt the identical production Worker and console script without dependency installation. See `recovery/cleanup.json`.
