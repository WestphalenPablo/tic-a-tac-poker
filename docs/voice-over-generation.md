# Generated voice-over (maybe someday)

Status: **parked, not being pursued.** Nothing here is in the code or the assets. Written 2026-11-04 so the research isn't lost.

## Goal
Replacement announcer clips for `sounds/pt/` (pair, straight, flush, three-of-a-kind, steal, straight-flush, royal-flush; joker is unused), in a "Candy Crush" style: bright, theatrical, energy rising with hand rank (pair about 2/10 up to royal flush 10/10, steal particularly energetic). Voice only, one consistent voice. Drop-in files must go through the pipeline in `sound-effects.md` (trim, two-pass `loudnorm` -16 LUFS / TP -1.5, 5 ms fade-in, mono 44.1 kHz MP3 `-q:a 4`).

## What was tried
- **Silvio Santos voice**: dropped. No sound-alike can be produced by Claude (it cannot generate audio), and cloning a real, deceased person's voice for a shippable game is a licensing risk (Brazilian post-mortem voice law has gaps; the family has objected publicly to unauthorized AI uses). ElevenLabs also restricts prominent public figures.
- **Local Kokoro-82M TTS** (CPU torch, voice `af_heart`, speed/pitch scaled per level, then the pipeline): 7 English clips of 0.5 to 1.15 s, loudness -16 LUFS. The result was judged poor (flat, not expressive). Everything installed was removed (venv, model weights, the session's pip cache entries); the generated clips were deleted.

## Option if revisited: ElevenLabs (hosted)
Not tried. Information is from third-party pricing blogs of 2026; confirm on the official pricing and terms pages.
- Free tier about 10,000 credits/month (roughly 10 minutes of speech), generally non-commercial. Starter about $5-6/month adds a commercial license, reportedly only for audio generated while subscribed (check whether kept clips stay licensed after cancelling). The 7 clips are well under a minute of audio.
- Eleven v3 supports inline audio tags (e.g. `[excited]`) for emotion; likely much better than Kokoro for this brief, unverified by ear.
- Plan: pick one preset upbeat game-show voice, generate 3-4 takes per phrase with escalating tags, run takes through the pipeline into a review folder (not over `sounds/pt/`), choose by ear, then swap in. Either an API script (key via env var, never pasted in chat) or the web UI with downloaded files.
- Open: English vs Portuguese phrases (the game plays `pt` clips for pt-BR; `sounds/en/` has only `flush.m4a`); the new clips would be much shorter than the current ones (1.9-6.5 s), so timing against `useSoundBusy` is untested.

## Not verified
Nothing in this doc was heard or tested beyond the Kokoro loudness measurements; ElevenLabs details are secondhand.
