# Design notes

Applied design-taste-frontend: `true-black-flat`, seed 226678596. No redraws. Inter is bundled for offline use. Black ground, neutral lightness steps, white primary transport and amber waveform/beat data; no gradients, glows or decorative scorecards.

Face: a recording console's amber beat markers. Signature: two actual waveform strips above one crossfader and four-beat phase indicators, with the current instruction beside the controls. Waveforms derive from actual audio samples. Song art is a small waveform mark, not a fabricated album cover.

Studio question: “How do I make the next blend?” Crate: “Which track should I load?” Learn: “What should I practice next?” Sources: “Which music can I mix and host?”

Two equal deck columns and one 14-pixel gap fill the mixing workspace. A side lesson pane appears when there is sufficient width; on portrait tablets it moves above the decks. Narrow screens stack the decks and use top navigation. Native sliders, labeled 44-pixel primary controls, focus outlines and reduced-motion support remain available.

Real data: original practice tracks at 120/124 BPM and five credited CC BY catalog tracks. No invented users, audiences, performance scores, history or Spotify playlists. Catalog BPM values are editable estimates. Completion begins at zero and follows the lesson state machine.

Design inspector: no failures on the initial three-width pass. Warnings included compact console metadata, actual waveform canvas hue not detected by the DOM color inspector and mismatched lower edges of a lesson pane next to stacked mixer blocks. Density and panel alignment were revised; intentional remaining deviations are documented in validation notes.
