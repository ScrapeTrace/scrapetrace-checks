# ST—005 cleanup manifest

Pre-existing user profiles, Chrome installations, dependency directories, battery source, and deployment are never cleanup targets.

- `/tmp/st005-research`: task-created retrieval scratch; remove at completion.
- `/tmp/st005-profile-*`: runner-created profiles; remove in runner finally after browser close.
- `st-005/dist`: generated final deployable artifact, retained.
- `st-005/raw`, `st-005/recovery`, `st-005/legacy`, `st-005/scripts`, `st-005/research`, `st-005/site`: final reproduction/source/evidence artifacts, retained.
- No test containers or images created. Existing Puppeteer dependency and browsers reused read-only.

Runtime databases use the unique `__st005_` prefix. Each invocation closes its connection and awaits deletion, recording success or failure. A tab/process crash can prevent cleanup; use site-data controls for the experiment origin. Never delete unrelated IndexedDB databases.
