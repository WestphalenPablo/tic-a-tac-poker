export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['S', 'H', 'D', 'C'] as const;
export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type PlayerId = 'p1' | 'p2';

/** A concrete card. `joker` marks a Joker that was assigned this identity (permanent). */
export interface Card {
  rank: Rank;
  suit: Suit;
  joker?: true;
}
export type Special = 'JOKER' | 'ROBBER';
export type DeckCard = Card | Special;
export type Cell = Card | null;
/** 9 cells, row-major: index = row * 3 + col. */
export type Grid = Cell[];

export type HandType =
  | 'PAIR'
  | 'FLUSH'
  | 'STRAIGHT'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT_FLUSH'
  | 'ROYAL_FLUSH';

export interface ScoredHand {
  line: string; // row_0..row_2, col_0..col_2, diag_0, diag_1
  type: HandType;
  points: number;
}

export type Move =
  /** Draft a card and place it. `as` is required iff the pool card is a Joker. */
  | { type: 'PLACE'; slot: number; cell: number; as?: { rank: Rank; suit: Suit } }
  /** Draft a Robber: move opponent's card `from` into own empty cell `to`. */
  | { type: 'STEAL'; slot: number; from: number; to: number };

export interface GameState {
  phase: 'playing' | 'finished';
  grids: Record<PlayerId, Grid>;
  /** 5 face-up slots; null only if the deck is completely exhausted. */
  pool: (DeckCard | null)[];
  deck: DeckCard[]; // draw from the front
  discard: DeckCard[]; // used Robbers; reshuffled if the deck runs dry
  current: PlayerId;
  /** Placements the current player still owes this turn (2 after being robbed). */
  placementsLeft: number;
  /** Extra placements owed to a player on their next turn (Robber compensation). */
  owed: Record<PlayerId, number>;
  /** Opening high-card draw, for display. */
  firstDraw: Record<PlayerId, Card>;
}

export interface GameResult {
  scores: Record<PlayerId, number>;
  hands: Record<PlayerId, number>;
  winner: PlayerId | 'draw';
}

/** Injected randomness: returns a float in [0, 1). */
export type Rng = () => number;
