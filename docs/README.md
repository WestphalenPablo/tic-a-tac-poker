# Docs

Working notes on what has been built and why. The master doc for rules and status is the repo-root `README.md`; these files record the work behind it.

| Doc | Covers |
|---|---|
| [changelog.md](changelog.md) | Client changes after the baseline: drag and drop, gamepad, responsive layout, sound pointer |
| [sound-effects.md](sound-effects.md) | Voice clips for hands/Joker/Robber, playback rules, ffmpeg pipeline |
| [first-draw.md](first-draw.md) | Who-starts ritual: decisions, rule change, implementation plan and status |
| [history.md](history.md) | Commit-by-commit timeline backfilled from git |
| [v1.md](v1.md) | The `v1` tag: canonical baseline of the single-player MVP |
| [github-pages.md](github-pages.md) | Static deploy to GitHub Pages: base path, sound URLs, workflow |
| [tutorial.md](tutorial.md) | Welcome/tutorial wizard modal: first launch, `?` button, input gating |
| [online-rooms-ui.md](online-rooms-ui.md) | Client side of online play: flow, screens, snapshot handling, names, reconnect, how it was verified |
| [multiplayer-server.md](multiplayer-server.md) | Decision: Node + `ws` server on Render, client stays on Pages (same repo, two hosts); open questions |

## Convention

Each piece of work gets or updates an MD here: what changed, where in the code, decisions and why, how it was verified, and what is not verified. Add new docs to the table above.
