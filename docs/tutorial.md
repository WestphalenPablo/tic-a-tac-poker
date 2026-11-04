# Welcome / tutorial wizard

**What:** a 5-step modal explaining the game (goal, draft and place, hands and points, Joker and Robber, who starts). It opens automatically on first launch and can be reopened with the `?` button in the header.

**Where:**
- `packages/client/src/Tutorial.tsx`: the modal, the step visuals (reuse `CardView`; the point table reads `POINTS` from `@tatp/game`, so it can't drift from scoring), and the `tatp.tutorialSeen` localStorage helpers.
- `packages/client/src/i18n.tsx`: `tut1..5Title/Body`, `howToPlay`, `next`, `back`, `skip`, `letsPlay` in en and pt-BR.
- `packages/client/src/App.tsx`: `help` state (initially true if the flag is unset), header button, and gating.

**Behaviour:**
- Close with ×, Esc, backdrop click, or the last button. Any close sets the seen flag.
- Esc and ←/→ work from the keyboard; the gamepad uses a/right = next, left = back, b = back (close on step 1).
- While open, `help` pauses player input, the bot and the app's gamepad handling. On first launch the opening high-card draw (`FirstDraw`) is only mounted after the modal closes, so it doesn't animate behind it.

**Why:** new players had no explanation of the pool draft, Joker or Robber. Kept to text plus a small card visual per step; no rules changed.

**Verified:** `pnpm typecheck` (en/pt-BR key parity) and `pnpm test`. **Not verified:** behaviour in a browser (first-launch flow, reopening mid-game, mobile layout, gamepad), and the Portuguese wording was not reviewed by a native reader.

## Update: no mode mentions

The MSN/Classic selector was removed from the header and the app always starts in MSN (`App.tsx`: `mode` is fixed; `Mode`/Classic stay implemented in `@tatp/game`, and the `modeMsn`/`modeClassic` i18n keys are unused for now). The tutorial no longer mentions modes and says "your opponent" instead of "the bot" (en and pt-BR). Verified: `pnpm typecheck`. Not verified: in a browser.

## Update: the tutorial now leads into a mode menu

The tutorial is still first-launch only (plus the `?` button). Closing it no longer drops straight into a bot game: the app shows the mode menu (*Play vs bot* / *Create a room to play a friend*). The menu appears on every visit to the root URL; the header *New game* button reopens it. Opened from a room link, the app shows the tutorial first (if never seen), then skips the menu and asks for a name to join that room. Details in [online-rooms-ui.md](online-rooms-ui.md). Verified in a browser (Playwright, Chromium): tutorial then menu on first load, no tutorial on reload.
