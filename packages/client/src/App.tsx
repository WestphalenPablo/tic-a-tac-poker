import {
  applyMove, chooseMove, newGame, other, result, scoreGrid, seeded,
  type Difficulty, type GameState, type Mode, type PlayerId, type Rank, type Suit,
} from '@tatp/game';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CardView } from './CardView';
import { LANGS, useI18n, type Lang } from './i18n';
import { JokerPicker } from './JokerPicker';
import { playClip, useSoundBusy } from './sounds';
import { useGamepad } from './useGamepad';
import { useHandSounds } from './useHandSounds';

const HUMAN: PlayerId = 'p1';

type Zone = 'mine' | 'pool' | 'theirs';
type Cursor = { zone: Zone; idx: number };

/** Moves the controller cursor. Layout: my board | pool column | bot board; boards are 3x3. */
function moveCursor(c: Cursor, dir: 'up' | 'down' | 'left' | 'right', poolSize: number, canTheirs: boolean): Cursor {
  const last = Math.max(0, poolSize - 1);
  if (c.zone === 'pool') {
    if (dir === 'up') return { ...c, idx: Math.max(0, c.idx - 1) };
    if (dir === 'down') return { ...c, idx: Math.min(last, c.idx + 1) };
    const row = Math.min(2, c.idx);
    if (dir === 'left') return { zone: 'mine', idx: row * 3 + 2 };
    return canTheirs ? { zone: 'theirs', idx: row * 3 } : c;
  }
  const row = Math.floor(c.idx / 3), col = c.idx % 3;
  if (dir === 'up') return { ...c, idx: Math.max(0, row - 1) * 3 + col };
  if (dir === 'down') return { ...c, idx: Math.min(2, row + 1) * 3 + col };
  const toPool = (c.zone === 'mine' && dir === 'right' && col === 2) || (c.zone === 'theirs' && dir === 'left' && col === 0);
  if (toPool) return { zone: 'pool', idx: Math.min(last, row) };
  return { ...c, idx: row * 3 + col + (dir === 'right' ? 1 : -1) };
}

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
  const [cursor, setCursor] = useState<Cursor>({ zone: 'pool', idx: 0 });
  const [padUsed, setPadUsed] = useState(false); // show controller cursor only after pad input

  const start = (m = mode) => { setGame(newGame(rng.current, m)); setSel(null); setJoker(null); setNote(''); };
  const scores = useMemo(() => ({ p1: scoreGrid(game.grids.p1), p2: scoreGrid(game.grids.p2) }), [game]);
  const handsByPlayer = useMemo(() => ({ p1: scores.p1.hands, p2: scores.p2.hands }), [scores]);
  useHandSounds(handsByPlayer, lang);
  const myTurn = game.phase === 'playing' && game.current === HUMAN;
  const soundBusy = useSoundBusy();
  const canAct = myTurn && !soundBusy; // input waits for voice clips to finish

  // Bot plays after a short pause.
  useEffect(() => {
    if (game.phase !== 'playing' || game.current === HUMAN || soundBusy) return;
    const timer = setTimeout(() => {
      const move = chooseMove(game, level, rng.current);
      const what = game.pool[move.slot];
      if (move.type === 'STEAL') { setNote(t('noteRobbed')); playClip(lang, 'steal', true); }
      else if (what === 'JOKER') { setNote(t('noteJoker')); playClip(lang, 'joker', true); }
      else setNote('');
      setGame(applyMove(game, move, rng.current));
    }, 900);
    return () => clearTimeout(timer);
  }, [game, level, t, lang, soundBusy]);

  const play = (slot: number, cell: number, as?: { rank: Rank; suit: Suit }) => {
    if (game.pool[slot] === 'JOKER') playClip(lang, 'joker', true);
    setGame(applyMove(game, { type: 'PLACE', slot, cell, as }, rng.current));
    setSel(null); setJoker(null);
  };

  const onPool = (slot: number) => {
    if (!canAct) return;
    const c = game.pool[slot];
    if (c == null) return;
    if (c === 'ROBBER') {
      if (!game.grids[other(HUMAN)].some(Boolean) || !game.grids[HUMAN].some((x) => !x)) return setNote(t('noteNoRobber'));
      setSel({ slot, kind: 'steal' });
    } else setSel({ slot, kind: 'place' });
  };

  const onMyCell = (i: number) => {
    if (!canAct || !sel || game.grids[HUMAN][i]) return;
    if (sel.kind === 'steal') {
      if (sel.from === undefined) return;
      playClip(lang, 'steal', true);
      setGame(applyMove(game, { type: 'STEAL', slot: sel.slot, from: sel.from, to: i }, rng.current));
      setSel(null);
    } else if (game.pool[sel.slot] === 'JOKER') setJoker(i);
    else play(sel.slot, i);
  };

  const onTheirCell = (i: number) => {
    if (canAct && sel?.kind === 'steal' && game.grids[other(HUMAN)][i]) setSel({ ...sel, from: i });
  };

  // Drag sources/targets (mouse). Touch and keyboard users keep the click flow.
  const dragPool = (slot: number) => () => onPool(slot);
  const dragTheirs = (i: number) => () => onTheirCell(i);

  const res = game.phase === 'finished' ? result(game) : null;
  const status = res ? t('gameOver')
    : !myTurn ? t('botTurn')
    : sel?.kind === 'steal' ? (sel.from === undefined ? t('pickSteal') : t('placeStolen'))
    : sel ? t('placeCard')
    : game.placementsLeft > 1 ? t('robbedPick') : t('yourTurn');

  const res0 = game.phase === 'finished';
  // The bot's grid is only reachable while choosing which card to rob.
  const canTheirs = myTurn && sel?.kind === 'steal' && sel.from === undefined;
  useEffect(() => {
    if (canTheirs || cursor.zone !== 'theirs') return;
    const empty = game.grids[HUMAN].findIndex((x) => !x);
    setCursor(sel && empty >= 0 ? { zone: 'mine', idx: empty } : { zone: 'pool', idx: 0 });
  }, [canTheirs, cursor.zone, sel, game]);
  useGamepad((a) => {
    if (joker !== null) return; // JokerPicker handles its own input
    if (res0) { if (a === 'a') start(); return; }
    setPadUsed(true);
    if (a === 'b') { setSel(null); return; }
    if (a === 'a') {
      if (cursor.zone === 'pool') onPool(cursor.idx);
      else if (cursor.zone === 'mine') onMyCell(cursor.idx);
      else onTheirCell(cursor.idx);
      return;
    }
    setCursor((c) => moveCursor(c, a, game.pool.length, canTheirs));
  });
  const focusAt = (zone: Zone, i: number) => padUsed && cursor.zone === zone && cursor.idx === i;

  return (
    <div className="mx-auto max-w-4xl p-2 sm:p-4" onPointerDown={() => setPadUsed(false)}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-msn to-sky-400 px-3 py-2 text-white shadow sm:mb-4 sm:px-4">
        <h1 className="text-lg font-extrabold sm:text-xl tracking-tight">{t('title')}</h1>
        <div className="flex flex-wrap gap-2 text-xs sm:gap-3 sm:text-sm">
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

      <div className="mb-3 rounded-full bg-white px-3 py-2 text-center text-xs sm:px-4 sm:text-sm font-medium shadow-sm">
        {status}{note && <span className="ml-3 text-slate-500">{note}</span>}
      </div>

      {/* <md: pool row on top, two boards below. md+: boards flank a vertical pool. */}
      <div className="grid grid-cols-2 items-start gap-2 sm:gap-4 md:grid-cols-[1fr_auto_1fr]">
        <Board who="p1" title={t('you')} color="you" game={game} scores={scores.p1} active={game.current === 'p1' && game.phase === 'playing'}
          onCell={onMyCell} focusIdx={focusAt('mine', cursor.idx) ? cursor.idx : -1} onDropCell={onMyCell} highlight={myTurn && !!sel && (sel.kind === 'place' || sel.from !== undefined)} />
        <div className="order-first col-span-2 flex flex-row flex-wrap justify-center gap-1.5 rounded-xl bg-sky-100 p-2 shadow-inner sm:gap-2 md:order-none md:col-span-1 md:flex-col md:flex-nowrap md:items-center">
          {game.pool.map((c, i) => <CardView card={c} selected={sel?.slot === i} focused={focusAt('pool', i)} onClick={() => onPool(i)}
            drag={myTurn && c != null ? { onDragStart: dragPool(i) } : undefined} />)}
        </div>
        <Board who="p2" title={t('bot')} color="bot" game={game} scores={scores.p2} active={game.current === 'p2' && game.phase === 'playing'}
          onCell={onTheirCell} focusIdx={focusAt('theirs', cursor.idx) ? cursor.idx : -1} onDragCell={myTurn && sel?.kind === 'steal' ? dragTheirs : undefined} onDropCell={onTheirCell} highlight={myTurn && sel?.kind === 'steal' && sel.from === undefined} />
      </div>

      {joker !== null && sel && <JokerPicker onCancel={() => setJoker(null)} onConfirm={(as) => play(sel.slot, joker, as)} />}

      {res && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40">
          <div className="w-[90vw] max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
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

function Board({ who, title, color, game, scores, active, onCell, highlight, focusIdx, onDragCell, onDropCell }: {
  who: PlayerId; title: string; color: 'you' | 'bot'; game: GameState;
  scores: ReturnType<typeof scoreGrid>; active: boolean; onCell: (i: number) => void; highlight: boolean;
  focusIdx: number;
  onDragCell?: (i: number) => () => void; onDropCell: (i: number) => void;
}) {
  const { t, lang } = useI18n();
  return (
    <section className={clsx('min-w-0 rounded-xl bg-white p-2 shadow sm:p-3', active && (color === 'you' ? 'ring-4 ring-you/50' : 'ring-4 ring-bot/50'))}>
      <div className="mb-2 flex items-center justify-between">
        <span className={clsx('font-bold', color === 'you' ? 'text-you' : 'text-bot')}>{title}</span>
        <span className="rounded-full bg-slate-800 px-3 py-0.5 font-mono text-base text-white sm:text-lg">{scores.total.toLocaleString(lang)}</span>
      </div>
      <div className="mb-2 flex min-h-6 flex-wrap gap-1 text-[11px]">
        {scores.hands.map((h) => <span key={h.line} className="rounded bg-sky-100 px-1.5 py-0.5" title={h.line}>{t(`hand.${h.type}`)} {h.points}</span>)}
      </div>
      <div className="grid grid-cols-3 justify-items-center gap-1 sm:gap-1.5">
        {game.grids[who].map((c, i) => (
          <div key={i} className={clsx(highlight && (who === 'p1' ? !c : !!c) && 'rounded-lg ring-2 ring-amber-400')}>
            <CardView small card={c} focused={focusIdx === i} onClick={() => onCell(i)}
              drag={{
                onDragStart: onDragCell && c ? onDragCell(i) : undefined,
                onDrop: () => onDropCell(i),
              }} />
          </div>
        ))}
      </div>
    </section>
  );
}
