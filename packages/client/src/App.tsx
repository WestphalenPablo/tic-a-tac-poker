import {
  applyMove, chooseMove, newGame, other, result, scoreGrid, seeded,
  type Difficulty, type GameState, type Mode, type PlayerId, type Rank, type Suit,
} from '@tatp/game';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CardView } from './CardView';
import { LANGS, useI18n, type Lang } from './i18n';
import { JokerPicker } from './JokerPicker';

const HUMAN: PlayerId = 'p1';

type Pending = { slot: number } & ({ kind: 'place' } | { kind: 'steal'; from?: number });

export function App() {
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<Mode>('MSN');
  const [level, setLevel] = useState<Difficulty>('hard');
  const rng = useRef(seeded(Date.now()));
  const [game, setGame] = useState<GameState>(() => newGame(rng.current, 'MSN'));
  const [sel, setSel] = useState<Pending | null>(null);
  const [joker, setJoker] = useState<number | null>(null); // target cell awaiting Joker identity
  const [note, setNote] = useState('');

  const start = (m = mode) => { setGame(newGame(rng.current, m)); setSel(null); setJoker(null); setNote(''); };
  const scores = useMemo(() => ({ p1: scoreGrid(game.grids.p1), p2: scoreGrid(game.grids.p2) }), [game]);
  const myTurn = game.phase === 'playing' && game.current === HUMAN;

  // Bot plays after a short pause.
  useEffect(() => {
    if (game.phase !== 'playing' || game.current === HUMAN) return;
    const timer = setTimeout(() => {
      const move = chooseMove(game, level, rng.current);
      const what = game.pool[move.slot];
      if (move.type === 'STEAL') setNote(t('noteRobbed'));
      else if (what === 'JOKER') setNote(t('noteJoker'));
      else setNote('');
      setGame(applyMove(game, move, rng.current));
    }, 900);
    return () => clearTimeout(timer);
  }, [game, level, t]);

  const play = (slot: number, cell: number, as?: { rank: Rank; suit: Suit }) => {
    setGame(applyMove(game, { type: 'PLACE', slot, cell, as }, rng.current));
    setSel(null); setJoker(null);
  };

  const onPool = (slot: number) => {
    if (!myTurn) return;
    const c = game.pool[slot];
    if (c == null) return;
    if (c === 'ROBBER') {
      if (!game.grids[other(HUMAN)].some(Boolean) || !game.grids[HUMAN].some((x) => !x)) return setNote(t('noteNoRobber'));
      setSel({ slot, kind: 'steal' });
    } else setSel({ slot, kind: 'place' });
  };

  const onMyCell = (i: number) => {
    if (!myTurn || !sel || game.grids[HUMAN][i]) return;
    if (sel.kind === 'steal') {
      if (sel.from === undefined) return;
      setGame(applyMove(game, { type: 'STEAL', slot: sel.slot, from: sel.from, to: i }, rng.current));
      setSel(null);
    } else if (game.pool[sel.slot] === 'JOKER') setJoker(i);
    else play(sel.slot, i);
  };

  const onTheirCell = (i: number) => {
    if (myTurn && sel?.kind === 'steal' && game.grids[other(HUMAN)][i]) setSel({ ...sel, from: i });
  };

  const res = game.phase === 'finished' ? result(game) : null;
  const status = res ? t('gameOver')
    : !myTurn ? t('botTurn')
    : sel?.kind === 'steal' ? (sel.from === undefined ? t('pickSteal') : t('placeStolen'))
    : sel ? t('placeCard')
    : game.placementsLeft > 1 ? t('robbedPick') : t('yourTurn');

  return (
    <div className="mx-auto max-w-4xl p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-msn to-sky-400 px-4 py-2 text-white shadow">
        <h1 className="text-xl font-extrabold tracking-tight">{t('title')}</h1>
        <div className="flex gap-3 text-sm">
          <select className="rounded bg-white/20 px-2 py-1" value={mode} onChange={(e) => { const m = e.target.value as Mode; setMode(m); start(m); }}>
            <option value="MSN" className="text-black">{t('modeMsn')}</option>
            <option value="CLASSIC" className="text-black">{t('modeClassic')}</option>
          </select>
          <select className="rounded bg-white/20 px-2 py-1" value={level} onChange={(e) => setLevel(e.target.value as Difficulty)}>
            <option value="easy" className="text-black">{t('botEasy')}</option>
            <option value="hard" className="text-black">{t('botHard')}</option>
          </select>
          <select aria-label={t('language')} className="rounded bg-white/20 px-2 py-1" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {(Object.keys(LANGS) as Lang[]).map((l) => <option key={l} value={l} className="text-black">{LANGS[l]}</option>)}
          </select>
          <button className="rounded bg-white/25 px-3 py-1 font-semibold hover:bg-white/40" onClick={() => start()}>{t('newGame')}</button>
        </div>
      </header>

      <div className="mb-3 rounded-full bg-white px-4 py-2 text-center text-sm font-medium shadow-sm">
        {status}{note && <span className="ml-3 text-slate-500">{note}</span>}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
        <Board who="p1" title={t('you')} color="you" game={game} scores={scores.p1} active={game.current === 'p1' && game.phase === 'playing'}
          onCell={onMyCell} highlight={myTurn && !!sel && (sel.kind === 'place' || sel.from !== undefined)} />
        <div className="flex flex-col items-center gap-2 rounded-xl bg-sky-100 p-2 shadow-inner">
          {game.pool.map((c, i) => <CardView key={i} card={c} selected={sel?.slot === i} onClick={() => onPool(i)} />)}
        </div>
        <Board who="p2" title={t('bot')} color="bot" game={game} scores={scores.p2} active={game.current === 'p2' && game.phase === 'playing'}
          onCell={onTheirCell} highlight={myTurn && sel?.kind === 'steal' && sel.from === undefined} />
      </div>

      {joker !== null && sel && <JokerPicker onCancel={() => setJoker(null)} onConfirm={(as) => play(sel.slot, joker, as)} />}

      {res && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="mb-1 text-2xl font-extrabold">{res.winner === 'draw' ? t('draw') : res.winner === HUMAN ? t('youWin') : t('botWins')}</h2>
            <p className="mb-4 text-sm text-slate-500">{t('summary')}</p>
            <table className="mb-5 w-full text-sm">
              <thead><tr className="text-slate-500"><th></th><th>{t('you')}</th><th>{t('bot')}</th></tr></thead>
              <tbody>
                <tr><td className="text-left">{t('points')}</td><td className="font-bold">{res.scores.p1}</td><td className="font-bold">{res.scores.p2}</td></tr>
                <tr><td className="text-left">{t('hands')}</td><td>{res.hands.p1}</td><td>{res.hands.p2}</td></tr>
              </tbody>
            </table>
            <button className="rounded bg-msn px-5 py-2 font-semibold text-white hover:bg-sky-700" onClick={() => start()}>{t('playAgain')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Board({ who, title, color, game, scores, active, onCell, highlight }: {
  who: PlayerId; title: string; color: 'you' | 'bot'; game: GameState;
  scores: ReturnType<typeof scoreGrid>; active: boolean; onCell: (i: number) => void; highlight: boolean;
}) {
  const { t, lang } = useI18n();
  return (
    <section className={clsx('rounded-xl bg-white p-3 shadow', active && (color === 'you' ? 'ring-4 ring-you/50' : 'ring-4 ring-bot/50'))}>
      <div className="mb-2 flex items-center justify-between">
        <span className={clsx('font-bold', color === 'you' ? 'text-you' : 'text-bot')}>{title}</span>
        <span className="rounded-full bg-slate-800 px-3 py-0.5 font-mono text-lg text-white">{scores.total.toLocaleString(lang)}</span>
      </div>
      <div className="mb-2 flex min-h-6 flex-wrap gap-1 text-[11px]">
        {scores.hands.map((h) => <span key={h.line} className="rounded bg-sky-100 px-1.5 py-0.5" title={h.line}>{t(`hand.${h.type}`)} {h.points}</span>)}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {game.grids[who].map((c, i) => (
          <div key={i} className={clsx(highlight && (who === 'p1' ? !c : !!c) && 'rounded-lg ring-2 ring-amber-400')}>
            <CardView small card={c} onClick={() => onCell(i)} />
          </div>
        ))}
      </div>
    </section>
  );
}
