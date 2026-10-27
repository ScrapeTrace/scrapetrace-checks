# Checks theme alignment — 27 October 2026

The Checks hub, battery and workload pages, environment page and IndexedDB timing page now share the main ScrapeTrace publication’s brand: charcoal background `#111015`, purple accent `#b7a4f0`, Inter Variable, the actual ScrapeTrace wordmark/favicon, flat bordered panels, responsive navigation and a common footer.

Brand reference: main-site source under `../scrapetrace`, checked against the deployed homepage at https://scrapetrace.com/. Exact palette and copied-asset hashes are in `raw/theme/brand-reference.json`. Fonts and images are served by Checks itself; no third-party font or analytics requests were introduced. Inter’s SIL OFL license is retained beside the font.

The recovered legacy source is unchanged. The build applies presentation changes to its serialized stylesheet/header/footer before wrapping the original Worker. The storage measurement script, console script and client application match the prior production hashes. Legacy collector/workload/network-gate code remains unchanged. Only expected presentation differences are removed when comparing legacy route responses.

Validation: all 19 existing checks pass, including real battery completion, IndexedDB cleanup and unsupported/error cases. Home, battery, environment and storage pages were checked at 1440px and 390px widths; no horizontal page overflow, missing logo, font failure or browser errors were found. Screenshots and reports are in `raw/theme/`. The battery chart also uses the purple accent through CSS.

Article drafts, user-supplied screenshots and preliminary provider notes remain separate from this theme deployment and were not published by this update.

Task-owned browser processes were closed and temporary profiles removed by the verification/capture scripts. No browser downloads, package installs, containers, test images or scratch downloads were created. Only final source, licensed brand assets, screenshots and verification/deployment records are retained.

Production deployment: `ca1cbb52-750c-488e-843b-35fe208e88e1` (success). Live desktop/mobile checks passed for all four pages. HTTP checks confirmed exact source matches for the theme, logo, font and unchanged experiment scripts; see `raw/theme/deployment.json`.
