# First Mix — project plan

## Desired outcome

Install a DJ learning PWA on iPad, practice with real decks and guided lessons, and mix a useful music crate. The original Spotify-library goal remains dependent on licensed partner access. The user subsequently selected downloadable, openly licensed music across house/techno, Afrobeats/amapiano and hip-hop/R&B.

## Phase 1 — working PWA

Implemented: responsive studio, two Web Audio decks, cue/seek, loops, nudges, tempo/phase sync, EQ, equal-power crossfader, four lessons with real completion rules, saved progress, local import/delete/search, manual beat-grid editing, music-source/style filters, credits, install manifest/icons, service worker and offline practice.

The build is static HTML/CSS/ES modules with zero production dependencies. Imported files stay in IndexedDB. Only the two active tracks decode into memory; audio contexts use 44.1 kHz. Compressed imports are capped at 30 MB / 12 minutes. Gain/EQ changes are smoothed. A master compressor and headroom reduce overload risk.

## Phase 2 — openly licensed music

Implemented starter crate:

| Collection | Recording | Artist | License |
|---|---|---|---|
| House | Lost The Plot | Beat Doctor / Toucan Music | CC BY 4.0 |
| House | World of Fantasy (Beat Doctor remix) | Psychadelik Pedestrian / Toucan Music | CC BY 4.0 |
| Afrobeat | Afrobeat | Alex Morgan / Free Music Archive | CC BY 4.0 |
| Amapiano | Hot Amapiano Beats | Alex Morgan / Free Music Archive | CC BY 4.0 |
| Hip-hop | Scatter | 1000 Handz / 1000Handz.com / Free Music Archive | CC BY 4.0 |
| Practice | After Hours / Open Water | First Mix originals | Project-created audio |

The Afrobeat/amapiano uploader discloses AI generation; preserve this disclosure. Famous DJs' sets and commercial hits are not assumed to be openly licensed. These are starter examples, not a claim to provide the “best DJs” or a full representative catalog of each genre. Afrobeat and contemporary Afrobeats are distinct; the app preserves the source genre.

Every hosted third-party file has a source URL, creator, license link, verification date and SHA-256 hash in `dist/assets/licenses.json`. Its downloaded bytes remain unchanged. Display attribution next to downloads and in the app's credits. Future acquisitions should prefer direct artist releases under CC0/CC BY or written permission explicitly covering hosting, client-side mixing, redistribution and downloads. Avoid NoDerivatives tracks; assess NonCommercial/ShareAlike terms against the actual product. A generic “royalty-free” or “free download” label is insufficient.

Sources verified November 18, 2026:
- https://www.toucanmusic.com/releases/tou253
- https://www.toucanmusic.com/releases/tou272
- https://freemusicarchive.org/music/alex-morgan/pop-afro-party-instrumentals/afrobeat-1/
- https://freemusicarchive.org/music/alex-morgan/pop-afro-party-instrumentals/hot-amapiano-beats/
- https://freemusicarchive.org/music/1000-handz/cc-by-free-to-use-melodic-rap-instrumentals-vol-2/scatter-2/
- https://creativecommons.org/licenses/by/4.0/

Next catalog work: human listening/curation, several compatible pairs per genre, verified downbeats and phrase cues, metadata review and independent artists with clear rights chains. Host a larger catalog in object storage/CDN, with a separate authenticated admin upload/rights review tool. No artist outreach has been sent.

## Phase 3 — validation and iPad beta

Automated: pure behavior/file-license tests, syntax checks, Chromium and WebKit end-to-end tests, real offline audio rendering, offline shell test, persistent import/grid checks and responsive overflow/screenshot checks. Validation outcomes are recorded separately in `docs/VALIDATION.md`.

Still required: real iPad Safari/home-screen installation, touch scrubbing, VoiceOver/Dynamic Type/browser text zoom, device latency and sustained two-track stress/memory/thermal checks, interruption and route behavior with speakers, wired/USB-C headphones and Bluetooth. Desktop WebKit is useful coverage but is not physical iPad verification.

User beta: observe 5–10 novice DJs completing the four lessons. Check whether they can repeat the transitions without instructions. Improve the curriculum based on actual mistakes.

## Phase 4 — more capable mixing

Add pitch-preserving time stretching (AudioWorklet/WASM), automatic onset/BPM estimation in a worker, visual beat-grid/phrase editing, tap tempo, quantized starts, headphone monitoring with suitable hardware/browser support, recording/export for appropriately licensed audio and MIDI where available. Benchmark each addition on the minimum iPad before expanding scope.

## Spotify dependency

Spotify supports selected licensed DJ apps, including iPad integrations. Its public developer policy still prohibits mixing or overlapping Spotify recordings. The public iOS SDK controls the Spotify app; it does not provide decodable dual-deck audio. A client ID or OAuth login does not resolve these restrictions.

Spotify access in this product needs written authorization and an appropriate licensed integration. Do not implement stream extraction, capture, DRM removal or a pretend working connection. Until rights are secured, keep it as an honest information screen linking to supported DJ apps.

Sources:
- https://newsroom.spotify.com/2025-09-24/dj-software-integration-premium/ (including December 2025 and September 2026 updates)
- https://developer.spotify.com/policy
- https://developer.spotify.com/compliance-tips
- https://developer.spotify.com/documentation/ios
- https://www.algoriddim.com/spotify

## Release and hosting

Publish the static PWA privately through the Sites plugin. Preserve the source repository and exact deployment commit. On another server, deploy `dist/` under HTTPS. Serve the manifest and service worker without long immutable caching; release cache revisions atomically. No backend, payment service, credentials or analytics are needed for this version. Public sharing is a separate audience choice.

Remaining production work: larger human-curated catalog, device acceptance, operational license-review workflow, support/privacy pages if sharing publicly, and error/usage instrumentation only with an explicit privacy design. No timeline is promised for Spotify partnership approval.
