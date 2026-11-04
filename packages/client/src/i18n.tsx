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
  howToPlay: 'How to play', next: 'Next', back: 'Back', skip: 'Skip', letsPlay: "Let's play",
  tut1Title: 'Build the best poker hands', tut1Body: 'Fill your 3x3 grid with cards. Every row, column and diagonal is a poker line that scores. The higher total wins.',
  tut2Title: 'Draft and place', tut2Body: 'On your turn, take one card from the pool in the middle and put it on an empty cell of your grid. Click it, or drag it. Then your opponent plays.',
  tut3Title: 'Hands and points', tut3Body: 'A line scores its best hand. A pair counts as soon as two cards match, even with the third cell empty. Ace works low or high.',
  tut4Title: 'Joker and Robber', tut4Body: 'The Joker becomes any card you choose. The Robber steals a card from your opponent, and the victim places two cards next turn.',
  tut5Title: 'Who starts?', tut5Body: 'Each side draws a card first: the higher card plays first. You can reopen this guide any time with the ? button.',
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
  howToPlay: 'Como jogar', next: 'Avançar', back: 'Voltar', skip: 'Pular', letsPlay: 'Vamos jogar',
  tut1Title: 'Monte as melhores mãos de pôquer', tut1Body: 'Preencha sua grade 3x3 com cartas. Cada linha, coluna e diagonal é uma linha de pôquer que pontua. Vence quem somar mais.',
  tut2Title: 'Escolha e coloque', tut2Body: 'Na sua vez, pegue uma carta do monte no centro e coloque em uma célula vazia da sua grade. Clique ou arraste. Depois joga o oponente.',
  tut3Title: 'Mãos e pontos', tut3Body: 'Cada linha vale sua melhor mão. Um par já conta com duas cartas iguais, mesmo com a terceira célula vazia. O Ás vale baixo ou alto.',
  tut4Title: 'Coringa e Ladrão', tut4Body: 'O Coringa vira a carta que você escolher. O Ladrão rouba uma carta do oponente, e a vítima joga duas cartas na vez seguinte.',
  tut5Title: 'Quem começa?', tut5Body: 'Cada lado sorteia uma carta antes: a mais alta joga primeiro. Você pode rever este guia a qualquer momento no botão ?.',
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
