# ST—005 future article outline

Working title: **Does IndexedDB durability timing detect Incognito—or storage behavior?**

1. Credit detectIncognito.js and state the research question: when does its 1.30 ratio threshold separate contexts, and where does it fail?
2. Establish the Chromium history: October 2025 flag; December engineering discussion; estimated 144 versus current Chrome Status metadata; version-specific SQLite code. Distinguish scheduling behavior from durability timing.
3. Explain strict/relaxed hints, sequential commits, warmups, upper median and timing overhead. Show actual source without describing elapsed times as physical fsync measurements.
4. Show user-supplied console outputs once received, explicitly labeling browser version, OS, normal/private ground truth and repetition count. **Pending: do not fill in invented output.**
5. Reproduce task-owned Puppeteer disk-backed headed/headless comparisons and show raw samples. Keep persistent-default and nonpersistent-context labels separate from a manually observed private window.
6. Show RAM-backed persistent profiles as a counterexample to “low ratio proves Incognito.” Discuss filesystem and backend effects without assigning an unmeasured causal mechanism.
7. Introduce `/incognito`, raw exports, cleanup and interpretation boundaries; link public reproduction source.
8. Provider phase, only after user observations: exact configurations, JS execution evidence, repeated completed runs, screenshots, failures and uncertainty. **Pending: no named comparative findings.**
9. Discuss limits: one host/version, correlated repeats, backend rollouts, scheduling, hardware, filesystem, load, timing quantization, spoofing and the gap between private-like and bot-like.

Publication gate: reconcile all dates and source links, obtain real manual console evidence, review all public claims against raw logs, and label provider phase as pending unless supported. This is an outline, not a finished blog.
