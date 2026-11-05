# Built-in AI check sources

Reviewed 5 November 2026. Uses the current global interfaces, without legacy `window.ai` aliases or polyfills. Options and results are retained so availability is tied to the tested configuration.

- [Chrome built-in AI getting started](https://developer.chrome.com/docs/ai/get-started): availability states, model readiness and activation requirements.
- [Prompt API](https://developer.chrome.com/docs/ai/prompt-api): LanguageModel, expected text languages, create, prompt and cancellation.
- [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api): session options and summarize.
- [Writer](https://developer.chrome.com/docs/ai/writer-api) and [Rewriter](https://developer.chrome.com/docs/ai/rewriter-api): operation names, text options and language declarations.
- [Proofreader](https://developer.chrome.com/docs/ai/proofreader-api): proofread, correctedInput and corrections response shape.
- [Language Detector](https://developer.chrome.com/docs/ai/language-detection): detect results with detectedLanguage/confidence.
- [Translator](https://developer.chrome.com/docs/ai/translator-api): language-pair availability, translate and per-origin initialisation.

The collector requests no model downloads: create is attempted only following an `available` result. Existing model files cannot be inspected by this page, and the browser can apply its own origin, activation, policy and resource restrictions. At most two functional checks run together. Every session is destroyed, with cancellation and late-create disposal on timeout. There are no cloud-model fallbacks or third-party client scripts.

A functional result requires promise-returning availability/create/operation calls, a session operation and destroy method, and a non-empty output of the expected shape. Receiver, abort and destroyed-session checks are additional observations. Passing does not attest a native backend, a model identity or detection effectiveness. Generative outputs are displayed rather than compared to a fixed reference answer. Candidate confidence vectors are retained as returned, without a benchmark or fingerprint claim.

The owner supplied prior LanguageDetector experiments as background. Their suggested research goals and exact Chrome-specific exception-message mutation were not adopted as requirements. This page is a capability and execution check.
