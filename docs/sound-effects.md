# Sound effects (voice clips)

Added 2026-11-03. The client plays short spoken clips when hands are made and on Joker/Robber moves. Only Portuguese (`pt-BR`) exists so far; other languages are silent.

## Behaviour

| Clip | Plays when |
|---|---|
| `pair`, `flush`, `straight`, `three-of-a-kind`, `straight-flush`, `royal-flush` | A hand newly appears in either grid (new `line:type` key for that player). Several at once: only the highest-scoring one plays. A pair upgrading to three of a kind counts as new. Starting a new game plays nothing. |
| `joker` | Anyone places a Joker (human: when the identity picker is confirmed; bot: when it plays it). |
| `steal` | Anyone completes a Robber move (human: when the stolen card is dropped; bot: when it robs you). |

Priority (`src/sounds.ts`): event clips (`joker`, `steal`) cut off whatever is playing. Hand clips cut off other hand clips but wait for a playing event clip to finish, so the "robbed" clip isn't lost to the hand it forms.

The UI waits for clips: `useSoundBusy()` (in `sounds.ts`) is true while a clip is playing or queued. `App.tsx` ignores pool/cell clicks, drags and gamepad actions until it clears (`canAct`), and the bot's 900 ms move timer doesn't start until it clears. The status text and highlights still follow whose turn it is. "New game" is not blocked. A clip that errors (missing file) or is blocked by autoplay is treated as finished immediately, so the UI never hangs on audio.

Autoplay may be blocked by the browser before the first interaction.

## Code

- `packages/client/src/sounds.ts`: `playClip(lang, clip, event?)`, `useSoundBusy()`, language-to-folder map (`pt-BR` -> `pt`), the priority rule.
- `packages/client/src/useHandSounds.ts`: diffs the scored hands of both grids per render and calls `playClip`.
- `packages/client/src/App.tsx`: calls `useHandSounds`, and `playClip` for Joker/steal in the bot effect, `play()` and `onMyCell`.
- Assets: `packages/client/public/sounds/pt/*.mp3`, served at `/sounds/pt/<clip>.mp3`.
- Sources: original recordings under `sounds/<lang>/` (`.m4a`).

## Audio processing

Recordings are converted from AAC `.m4a` to mono 44.1 kHz MP3 (`libmp3lame -q:a 4`, about 8-32 KB each). MP3 plays in every browser without a fallback.

Per file (two-pass ffmpeg):

1. Trim leading and trailing silence: `silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05`, applied, then `areverse`, applied again, then `areverse`.
2. Normalize with `loudnorm=I=-16:TP=-1.5:LRA=11`. Pass 1 measures; pass 2 feeds the measured values back with `linear=true`.
3. 5 ms fade-in (`afade=t=in:d=0.005`) to avoid a click.

Result: every clip measures about -16 LUFS (originals ranged from -35 to -21.6), peaks no higher than -1.5 dBFS. Trimming cut roughly 0.8 s of silence from each end of typical clips.

**Replacement takes** (e.g. `straight`, 2026-11-03, source in `sounds/pt/new/straight.m4a`) go through the same pipeline and overwrite the `.mp3`. That take is very peaky (crest factor about 16 dB), so the -1.5 dBFS true-peak cap limits `linear=true` gain and it lands at -17.4 LUFS instead of -16 (`royal-flush` is similarly -16.6). Left as is rather than letting `loudnorm` fall back to dynamic mode. Measured after MP3 encoding, true peaks of several clips are above 0 dBFS (up to +1.3); MP3 encoding overshoots the pre-encode -1.5 cap.

The `three-ofa-kind` source filename was fixed to `three-of-a-kind` in the output.

## Not verified

Checked with `pnpm typecheck`, `pnpm test`, and ffmpeg loudness/duration measurements. Not played in a browser, so clip audibility, timing against the 900 ms bot delay, and the event/hand queueing, and the input/bot waiting are untested by ear.

## Open items

- No `en` clips yet (`sounds/en/` has only `flush.m4a`).
