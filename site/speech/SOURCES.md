# Speech check sources

- [Web Speech API specification, speech synthesis](https://webaudio.github.io/web-speech-api/#tts-section): getVoices, asynchronous voice discovery, voiceschanged, voice attributes, synthesis queue state and utterance events.

The automatic collection reads voices and queue state without speaking, cancelling or changing that queue. It samples page and frame independently for three seconds, and compares final voice values and order. Three final reads in each context check immediate repeatability. Empty lists remain readable results, distinct from missing or failing APIs.

Only an explicit Test voice click submits an utterance. A busy queue is left alone. The test observes events for at most 15 seconds and never automatically cancels the shared queue; a deadline ends observation, not the queued utterance. Late events cannot turn a timed-out test into a completed result. Local/remote describes the returned localService field, not measured network traffic.

Verification: `npm run build && npm run test:speech`. Controlled fixtures are functional checks, not provider measurements.
