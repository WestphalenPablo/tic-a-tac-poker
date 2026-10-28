# Tic-a-Tac Poker

A modern reimagining and complete implementation blueprint for the classic **Tic-a-Tac Poker** game originally featured on **MSN Messenger** and **MSN Games (Zone.com)** in the 2000s.

## Documentation & Blueprint

A comprehensive, ready-to-implement game design document and technical specification is available at:

📄 **[TIC_A_TAC_POKER_BLUEPRINT.md](file:///home/pablo/tic-a-tac-toe/TIC_A_TAC_POKER_BLUEPRINT.md)**

### What is Inside the Blueprint:
1. **Game Overview & Core Pillars:** History, core concept, 3x3 grid mechanics.
2. **Board Anatomy & Line Geometry:** 8 scoring lines (3 rows, 3 columns, 2 diagonals), cell leverage calculations.
3. **Card Deck & Hand Evaluation:** Full 3-card poker combinatorics and mathematical ranking (Straight Flush > Three of a Kind > Straight > Flush > Pair > High Card).
4. **Scoring System & Math:** Calibrated points, rank bonuses, diagonal multipliers, and clean sweep bonuses.
5. **Gameplay Loops & Modes:**
   - Classic 1v1 Multiplayer Duel (MSN Messenger draft loop)
   - Solo High-Score Challenge (with limited discards)
   - Chaos / Party Variant (Jokers & Thief sabotage cards)
6. **Tactical Strategy:** Center square gambit, suit clustering, and hate-drafting denial math.
7. **Visual & UX Design:** Retro Y2K MSN Messenger skeuomorphism meets modern responsive UI, screen layout diagrams, micro-interactions, and the legendary MSN Nudge.
8. **Audio Design:** Comprehensive soundscape specification.
9. **Technical Architecture & Data Models:** TypeScript schemas for cards, grids, hands, and state.
10. **Evaluation Engine & Bot AI:** Pure TypeScript evaluation algorithm + AI decision heuristics (Easy, Medium, Hard denial-weighted Minimax).
11. **Multiplayer Protocol:** Authoritative WebSocket event specifications.
12. **Implementation Roadmap:** Step-by-step phased execution plan for developers and AI agents.
