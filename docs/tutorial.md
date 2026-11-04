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
