import {
  applyMove, chooseMove, newGame, other, result, scoreGrid, seeded,
  type Difficulty, type GameState, type Mode, type Move, type PlayerId, type Rank, type Suit,
} from '@tatp/game';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { animateBotMove, cancelAnimations } from './animations';
import { CardView } from './CardView';
import { SERVER_URL, wakeServer } from './config';
import { FirstDraw } from './FirstDraw';
import { LANGS, useI18n, type Lang } from './i18n';
import { JokerPicker } from './JokerPicker';
import { MenuModal, NamePrompt, NoticeModal, RoomModal, saveName } from './Lobby';
import { getRoomId, roomUrl, showHomeInUrl, showRoomInUrl } from './route';
import { playClip, useSoundBusy } from './sounds';
import { playFlip } from './sfx';
import { markTutorialSeen, seenTutorial, Tutorial } from './Tutorial';
import { useGamepad } from './useGamepad';
import { useHandSounds } from './useHandSounds';
import { useHandReveal } from './useHandReveal';
import { useRoom, type Incoming } from './useRoom';

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

/** menu: choosing a mode. name: asking for the display name before an online room. bot / online: a game. */
type Screen = 'menu' | 'name' | 'bot' | 'online';

type Pending = { slot: number } & ({ kind: 'place' } | { kind: 'steal'; from?: number });

export function App() {
  const { t, lang, setLang } = useI18n();
  const [mode] = useState<Mode>('MSN'); // Classic stays implemented but is not exposed in the UI for now
  const [level, setLevel] = useState<Difficulty>('easy');
  const rng = useRef(seeded(Date.now()));
  const [game, setGame] = useState<GameState>(() => newGame(rng.current, 'MSN'));
  const [sel, setSel] = useState<Pending | null>(null);
  const [joker, setJoker] = useState<number | null>(null); // target cell awaiting Joker identity
  const [note, setNote] = useState('');
  const [cursor, setCursor] = useState<Cursor>({ zone: 'pool', idx: 0 });
  const [padUsed, setPadUsed] = useState(false); // show controller cursor only after pad input

  const [intro, setIntro] = useState(true); // opening high-card draw ritual; holds input and the bot
  const [help, setHelp] = useState(() => !seenTutorial()); // welcome/tutorial modal; also pauses input and the bot
  const closeHelp = () => { markTutorialSeen(); setHelp(false); };
  const [gameId, setGameId] = useState(0); // remounts the ritual when a new game starts

  // Opened from a room link? Then we skip the menu and ask for a name to join that room.
  const [joinId, setJoinId] = useState(getRoomId);
  const [screen, setScreen] = useState<Screen>(() => (getRoomId() ? 'name' : 'menu'));
  const online = screen === 'online';
  const [gotState, setGotState] = useState(false); // first server snapshot received
  const [awaiting, setAwaiting] = useState(false); // our move is sent; waiting for the server's snapshot
  const [inbox, setInbox] = useState<Incoming[]>([]); // server snapshots not yet shown (held back during the opening draw/animations)
  const room = useRoom(
    (m) => setInbox((q) => [...q, m]),
    () => { setAwaiting(false); setNote(t('noteRejected')); },
  );
  const youName = online && room.info ? room.info.you : t('you');
  const oppName = online ? (room.info?.opponent ?? '') : t('bot');
  const inGame = screen === 'bot' || (online && gotState);

  const start = (m = mode) => { setGame(newGame(rng.current, m)); setSel(null); setJoker(null); setNote(''); setIntro(true); setGameId((n) => n + 1); };
  const scores = useMemo(() => ({ p1: scoreGrid(game.grids.p1), p2: scoreGrid(game.grids.p2) }), [game]);
  const handsByPlayer = useMemo(() => ({ p1: scores.p1.hands, p2: scores.p2.hands }), [scores]);
  useHandSounds(handsByPlayer, lang);
  const myTurn = game.phase === 'playing' && game.current === HUMAN;
  const soundBusy = useSoundBusy();
  const canAct = myTurn && inGame && !soundBusy && !intro && !help && !awaiting && (!online || room.link === 'open'); // input waits for voice clips and the opening draw

  // Bot plays after a short pause.
  useEffect(() => {
    if (screen !== 'bot' || game.phase !== 'playing' || game.current === HUMAN || soundBusy || intro || help) return;
    let dead = false;
    const timer = setTimeout(() => {
      const move = chooseMove(game, level, rng.current);
      const what = game.pool[move.slot];
      const next = applyMove(game, move, rng.current);
      if (move.type === 'STEAL') setNote(t('noteRobbed'));
      else if (what === 'JOKER') setNote(t('noteJoker'));
      else setNote('');
      // Show the move first; the state change lands with the card, then the voice clip plays.
      void animateBotMove(move, what === 'JOKER', () => {
        if (move.type === 'STEAL') playClip(lang, 'steal', true);
        playFlip();
        setGame(next);
      }, () => dead);
    }, 600);
    return () => { dead = true; clearTimeout(timer); cancelAnimations(); };
  }, [screen, game, level, t, lang, soundBusy, intro, help]);

  // Online: show server snapshots one at a time. A new game applies at once; the rest wait for the opening
  // draw, and the opponent's moves are animated like the bot's.
  const gameRef = useRef(game);
  gameRef.current = game;
  const pumping = useRef(false);
  const epoch = useRef(0); // bumped when leaving a room, to cancel an animation in flight
  useEffect(() => {
    if (!online || pumping.current) return;
    const m = inbox[0];
    if (!m) return;
    const shift = () => setInbox((q) => q.slice(1));
    if (m.fresh) {
      setGame(m.state); setGotState(true); setSel(null); setJoker(null); setNote(''); setAwaiting(false);
      setIntro(true); setGameId((n) => n + 1);
      shift();
      return;
    }
    if (!gotState) {
      // First snapshot of this session and not a new game: we reconnected to a game in progress (page refresh).
      setGame(m.state); setGotState(true); setIntro(false); setAwaiting(false);
      shift();
      return;
    }
    if (intro) return; // re-runs when the opening draw ends
    const mv = m.lastMove;
    if (mv?.by === 'opponent') {
      pumping.current = true;
      const mine = epoch.current;
      const what = gameRef.current.pool[mv.move.slot];
      const steal = mv.move.type === 'STEAL';
      setNote(steal ? t('noteRobbedBy', { name: oppName }) : what === 'JOKER' ? t('noteJokerBy', { name: oppName }) : '');
      void animateBotMove(mv.move, what === 'JOKER', () => {
        if (steal) playClip(lang, 'steal', true);
        playFlip();
        setGame(m.state); setGotState(true);
      }, () => epoch.current !== mine).then(() => {
        pumping.current = false;
        if (epoch.current === mine) shift();
      });
      return;
    }
    setGame(m.state); setGotState(true); setAwaiting(false);
    shift();
  }, [online, inbox, intro, gotState, t, lang, oppName]);

  // Our own move goes to the server; the new state comes back as a snapshot.
  const submit = (move: Move) => {
    if (online) { if (room.sendMove(move)) setAwaiting(true); }
    else setGame(applyMove(game, move, rng.current));
    setSel(null); setJoker(null);
  };

  useEffect(() => { if (room.roomId) showRoomInUrl(room.roomId); }, [room.roomId]);
  useEffect(() => { if (screen === 'menu') wakeServer(); }, [screen]);

  const play = (slot: number, cell: number, as?: { rank: Rank; suit: Suit }) => {
    playFlip();
    submit({ type: 'PLACE', slot, cell, as });
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
      playFlip();
      submit({ type: 'STEAL', slot: sel.slot, from: sel.from, to: i });
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
    : online && room.link !== 'open' ? t('reconnecting')
    : online && room.info?.status === 'waiting' ? t('waitingFriend')
    : online && room.info?.opponent && !room.info.opponentOnline ? t('oppOffline', { name: oppName })
    : !myTurn ? (online ? t('opponentTurn', { name: oppName }) : t('botTurn'))
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
    if (help || intro || joker !== null || !inGame) return; // opening draw is not interactive; JokerPicker handles its own input
    if (res0) { if (a === 'a') (online ? room.rematch() : start()); return; }
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

  // Leaving a room closes it for both players. Nothing of the online session survives the menu.
  const leaveOnline = () => {
    epoch.current++;
    pumping.current = false;
    cancelAnimations();
    room.leave();
    setInbox([]); setGotState(false); setAwaiting(false); setJoinId(null);
    showHomeInUrl();
  };
  const toMenu = () => { leaveOnline(); setScreen('menu'); };
  const askMenu = () => {
    if (online && room.info?.status === 'playing' && !window.confirm(t('leaveConfirm'))) return;
    toMenu();
  };
  const chooseBot = () => { leaveOnline(); start(); setScreen('bot'); };
  const submitName = (name: string) => {
    saveName(name);
    setInbox([]); setGotState(false); setAwaiting(false);
    setScreen('online');
    if (joinId) room.join(joinId, name); else room.create(name);
  };
  const errorText = room.error === 'room_full' ? { title: t('roomFull'), body: t('roomFullBody') }
    : room.error === 'server_full' ? { title: t('serverFull'), body: t('serverFullBody') }
    : { title: t('roomNotFound'), body: t('roomNotFoundBody') };

  return (
    <div className="mx-auto max-w-4xl p-2 sm:p-4" onPointerDown={() => setPadUsed(false)}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-msn to-sky-400 px-3 py-2 text-white shadow sm:mb-4 sm:px-4">
        <h1 className="text-lg font-extrabold sm:text-xl tracking-tight">{t('title')}</h1>
        <div className="flex flex-wrap gap-2 text-xs sm:gap-3 sm:text-sm">
          {!online && (
            <select className="rounded bg-white/20 px-2 py-1" value={level} onChange={(e) => setLevel(e.target.value as Difficulty)}>
              <option value="easy" className="text-black">{t('botEasy')}</option>
              <option value="hard" className="text-black">{t('botHard')}</option>
            </select>
          )}
          <select aria-label={t('language')} className="rounded bg-white/20 px-2 py-1" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {(Object.keys(LANGS) as Lang[]).map((l) => <option key={l} value={l} className="text-black">{LANGS[l]}</option>)}
          </select>
          <button aria-label={t('howToPlay')} title={t('howToPlay')} className="rounded bg-white/25 px-3 py-1 font-semibold hover:bg-white/40" onClick={() => setHelp(true)}>?</button>
          <button className="rounded bg-white/25 px-3 py-1 font-semibold hover:bg-white/40" onClick={askMenu}>{t('newGame')}</button>
        </div>
      </header>

      <div className="mb-3 rounded-full bg-white px-3 py-2 text-center text-xs sm:px-4 sm:text-sm font-medium shadow-sm">
        {status}{note && <span className="ml-3 text-slate-500">{note}</span>}
      </div>

      {/* <md: pool row on top, two boards below. md+: boards flank a vertical pool. */}
      <div className="grid grid-cols-2 items-start gap-2 sm:gap-4 md:grid-cols-[1fr_auto_1fr]">
        <Board who="p1" title={youName} color="you" game={game} scores={scores.p1} active={game.current === 'p1' && game.phase === 'playing'}
          onCell={onMyCell} focusIdx={focusAt('mine', cursor.idx) ? cursor.idx : -1} onDropCell={onMyCell} highlight={myTurn && !!sel && (sel.kind === 'place' || sel.from !== undefined)} />
        <div className="order-first col-span-2 flex flex-row flex-wrap justify-center gap-1.5 rounded-xl bg-sky-100 p-2 shadow-inner sm:gap-2 md:order-none md:col-span-1 md:flex-col md:flex-nowrap md:items-center">
          {game.pool.map((c, i) => <div key={i} data-pool={i}><CardView card={c} selected={sel?.slot === i} focused={focusAt('pool', i)} onClick={() => onPool(i)}
            drag={myTurn && c != null ? { onDragStart: dragPool(i) } : undefined} /></div>)}
        </div>
        <Board who="p2" title={oppName} color="bot" game={game} scores={scores.p2} active={game.current === 'p2' && game.phase === 'playing'}
          onCell={onTheirCell} focusIdx={focusAt('theirs', cursor.idx) ? cursor.idx : -1} onDragCell={myTurn && sel?.kind === 'steal' ? dragTheirs : undefined} onDropCell={onTheirCell} highlight={myTurn && sel?.kind === 'steal' && sel.from === undefined} />
      </div>

      {help && <Tutorial onClose={closeHelp} />}

      {!help && screen === 'menu' && <MenuModal onBot={chooseBot} onRoom={SERVER_URL ? () => { setJoinId(null); setScreen('name'); } : undefined} />}
      {!help && screen === 'name' && <NamePrompt onSubmit={submitName} onBack={toMenu} />}
      {!help && online && room.error && <NoticeModal title={errorText.title} body={errorText.body} action={t('backToMenu')} onAction={toMenu} />}
      {!help && online && !room.error && room.info?.status === 'closed' && <NoticeModal title={t('roomClosed')} body={t('roomClosedBody')} action={t('backToMenu')} onAction={toMenu} />}
      {!help && online && !room.error && room.info?.status === 'waiting' && room.roomId && <RoomModal url={roomUrl(room.roomId)} offline={room.link !== 'open'} onLeave={toMenu} />}
      {!help && online && !room.error && !gotState && !room.info && <NoticeModal title={room.slow ? t('wakingTitle') : t('connecting')} body={room.slow ? t('wakingBody') : undefined} action={t('cancel')} onAction={toMenu} />}

      {intro && !help && inGame && (
        <FirstDraw key={gameId} draws={game.firstDraws} starter={game.current} onDone={() => setIntro(false)}
          youName={online ? youName : undefined} oppName={online ? oppName : undefined} />
      )}

      {joker !== null && sel && <JokerPicker onCancel={() => setJoker(null)} onConfirm={(as) => play(sel.slot, joker, as)} />}

      {res && inGame && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40">
          <div className="w-[90vw] max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="mb-1 text-2xl font-extrabold">{res.winner === 'draw' ? t('draw') : res.winner === HUMAN ? t('youWin') : online ? t('oppWins', { name: oppName }) : t('botWins')}</h2>
            <p className="mb-4 text-sm text-slate-500">{t('summary')}</p>
            <table className="mb-5 w-full text-sm">
              <thead><tr className="text-slate-500"><th></th><th>{youName}</th><th>{oppName}</th></tr></thead>
              <tbody>
                <tr><td className="text-left">{t('points')}</td><td className="font-bold">{res.scores.p1}</td><td className="font-bold">{res.scores.p2}</td></tr>
                <tr><td className="text-left">{t('hands')}</td><td>{res.hands.p1}</td><td>{res.hands.p2}</td></tr>
              </tbody>
            </table>
            {online ? (
              <>
                {room.info?.rematch.opponent && !room.info.rematch.you && <p className="mb-2 text-sm text-slate-600">{t('rematchAsked', { name: oppName })}</p>}
                <div className="flex justify-center gap-2">
                  <button className="rounded px-4 py-2 text-slate-600 hover:bg-slate-100" onClick={toMenu}>{t('leaveRoom')}</button>
                  <button className="rounded bg-msn px-5 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-60" disabled={room.info?.rematch.you} onClick={room.rematch}>
                    {room.info?.rematch.you ? t('rematchWaiting', { name: oppName }) : t('playAgain')}
                  </button>
                </div>
              </>
            ) : (
              <button className="rounded bg-msn px-5 py-2 font-semibold text-white hover:bg-sky-700" onClick={() => start()}>{t('playAgain')}</button>
            )}
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
  const reveal = useHandReveal(scores.hands, game.grids[who]);
  return (
    <section className={clsx('min-w-0 rounded-xl bg-white p-2 shadow sm:p-3', active && (color === 'you' ? 'ring-4 ring-you/50' : 'ring-4 ring-bot/50'))}>
      <div className="mb-2 flex items-center justify-between">
        <span className={clsx('font-bold', color === 'you' ? 'text-you' : 'text-bot')}>{title}</span>
        <span className="rounded-full bg-slate-800 px-3 py-0.5 font-mono text-base text-white sm:text-lg">{scores.total.toLocaleString(lang)}</span>
      </div>
      <div className="mb-2 flex min-h-6 flex-wrap gap-1 text-[11px]">
        {scores.hands.map((h) => <span key={h.line} className="rounded bg-sky-100 px-1.5 py-0.5" title={h.line}>{t(`hand.${h.type}`)} {h.points}</span>)}
      </div>
      <div className="grid grid-cols-[repeat(3,auto)] justify-center gap-2 sm:gap-4">
        {game.grids[who].map((c, i) => (
          <div key={reveal.cells.has(i) ? `${i}-${reveal.key}` : i} data-cell={`${who}-${i}`} className={clsx('rounded-lg', highlight && (who === 'p1' ? !c : !!c) && 'ring-2 ring-amber-400', reveal.cells.has(i) && 'hand-reveal')}>
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
