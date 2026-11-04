import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const en = {
  title: 'Tic-a-Tac Poker',
  modeMsn: 'MSN (Joker + Robber)', modeClassic: 'Classic',
  botEasy: 'Easy bot', botHard: 'Hard bot',
  newGame: 'New game', playAgain: 'Play again', language: 'Language',
  you: 'You', bot: 'Bot',
  'hand.PAIR': 'Pair', 'hand.FLUSH': 'Flush', 'hand.STRAIGHT': 'Straight',
  'hand.THREE_OF_A_KIND': 'Three of a kind', 'hand.STRAIGHT_FLUSH': 'Straight flush', 'hand.ROYAL_FLUSH': 'Royal flush',
  robber: 'ROBBER', joker: 'JOKER',
  noteRobbed: '🦹 The bot robbed your card! You place 2 cards next turn.',
  noteJoker: '🃏 The bot played a Joker.',
  noteNoRobber: "Can't use the Robber right now.",
  gameOver: 'Game over', botTurn: "Bot's turn…",
  pickSteal: 'Pick a card to steal from the bot',
  placeStolen: 'Place the stolen card on an empty cell',
  placeCard: 'Place the card on an empty cell of your grid',
  robbedPick: 'Robbed! Place 2 cards: pick a card',
  yourTurn: 'Your turn: pick a card from the pool',
  draw: "It's a draw!", youWin: '🏆 You win!', botWins: 'The bot wins',
  summary: 'Match summary', points: 'Points', hands: 'Completed hands',
  jokerTitle: "Choose the Joker's card", cancel: 'Cancel', confirm: 'Confirm',
  drawTitle: 'The highest card plays first!', drawTie: 'Tie! Drawing again…',
  drawYouFirst: 'You play first', drawBotFirst: 'The bot plays first',
};
export type Key = keyof typeof en;

const ptBR: Record<Key, string> = {
  title: 'Tic-a-Tac Poker',
  modeMsn: 'MSN (Coringa + Ladrão)', modeClassic: 'Clássico',
  botEasy: 'Bot fácil', botHard: 'Bot difícil',
  newGame: 'Novo jogo', playAgain: 'Jogar novamente', language: 'Idioma',
  you: 'Você', bot: 'Bot',
  'hand.PAIR': 'Par', 'hand.FLUSH': 'Flush', 'hand.STRAIGHT': 'Sequência',
  'hand.THREE_OF_A_KIND': 'Trinca', 'hand.STRAIGHT_FLUSH': 'Straight flush', 'hand.ROYAL_FLUSH': 'Royal flush',
  robber: 'LADRÃO', joker: 'CORINGA',
  noteRobbed: '🦹 O bot roubou sua carta! Você joga 2 cartas na próxima vez.',
  noteJoker: '🃏 O bot jogou um Coringa.',
  noteNoRobber: 'Não é possível usar o Ladrão agora.',
  gameOver: 'Fim de jogo', botTurn: 'Vez do bot…',
  pickSteal: 'Escolha uma carta do bot para roubar',
  placeStolen: 'Coloque a carta roubada em uma célula vazia',
  placeCard: 'Coloque a carta em uma célula vazia da sua grade',
  robbedPick: 'Roubado! Jogue 2 cartas: escolha uma carta',
  yourTurn: 'Sua vez: escolha uma carta do monte',
  draw: 'Empate!', youWin: '🏆 Você venceu!', botWins: 'O bot venceu',
  summary: 'Resumo da partida', points: 'Pontos', hands: 'Mãos completas',
  jokerTitle: 'Escolha a carta do Coringa', cancel: 'Cancelar', confirm: 'Confirmar',
  drawTitle: 'A carta mais alta joga primeiro!', drawTie: 'Empate! Sorteando de novo…',
  drawYouFirst: 'Você joga primeiro', drawBotFirst: 'O bot joga primeiro',
};

export const LANGS = { en: 'English', 'pt-BR': 'Português (Brasil)' } as const;
export type Lang = keyof typeof LANGS;
const DICTS: Record<Lang, Record<Key, string>> = { en, 'pt-BR': ptBR };
const STORAGE_KEY = 'tatp.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in LANGS) return saved as Lang;
  } catch { /* storage unavailable */ }
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of prefs) if (l?.toLowerCase().startsWith('pt')) return 'pt-BR';
  return 'en';
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string };
const I18nContext = createContext<Ctx>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (k) => DICTS[lang][k] }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
