import type { Card, PlayerId } from '@tatp/game';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { CardView } from './CardView';
import { useI18n } from './i18n';
import { playFlip, playTie, playWin } from './sfx';

type Draw = Record<PlayerId, Card>;
type View = { round: number; you: boolean; bot: boolean; tie: boolean; winner: boolean };

/** Timings (ms). One decisive round totals LEAD + DECISIVE = 5000; each tied round adds TIED. */
const LEAD = 600, YOU_AFTER = 200, BOT_AFTER = 1250, WINNER_AFTER = 2200, DECISIVE = 4400;
const TIE_BOT_AFTER = 800, TIE_MSG_AFTER = 1300, TIED = 2000;

type Step = { at: number; view: View; sound?: () => void };

/** Pure timeline: tied rounds first (you, bot, "tie"), then the decisive round (you, bot, winner). */
export function drawTimeline(rounds: number): { steps: Step[]; total: number } {
  const steps: Step[] = [];
  let t = LEAD;
  for (let r = 0; r < rounds; r++) {
    const last = r === rounds - 1;
    const v = (p: Partial<View>): View => ({ round: r, you: false, bot: false, tie: false, winner: false, ...p });
    steps.push({ at: t, view: v({}) }); // show face-down cards for this round
    steps.push({ at: t + YOU_AFTER, view: v({ you: true }), sound: playFlip });
    const bot = last ? BOT_AFTER : TIE_BOT_AFTER;
    steps.push({ at: t + bot, view: v({ you: true, bot: true }), sound: playFlip });
    if (last) {
      steps.push({ at: t + WINNER_AFTER, view: v({ you: true, bot: true, winner: true }), sound: playWin });
      t += DECISIVE;
    } else {
      steps.push({ at: t + TIE_MSG_AFTER, view: v({ you: true, bot: true, tie: true }), sound: playTie });
      t += TIED;
    }
  }
  return { steps, total: t };
}

function Flip({ children, shown }: { children: React.ReactNode; shown: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shown) ref.current?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 220, easing: 'ease-out' });
  }, [shown]);
  return <div ref={ref}>{children}</div>;
}

const Back = () => (
  <div className="h-28 w-20 rounded-lg border border-sky-700 bg-gradient-to-br from-sky-500 to-sky-700 shadow sm:h-32 sm:w-24" />
);

/**
 * Opening "highest card plays first" ritual. Not skippable. Locks the game (the parent holds input and
 * the bot) until `onDone`. `draws` is `GameState.firstDraws` (every tied round is replayed); `starter` is
 * `GameState.current` at the start, i.e. the winner of the last round.
 */
export function FirstDraw({ draws, starter, onDone, youName, oppName }: {
  draws: Draw[]; starter: PlayerId; onDone: () => void;
  /** Online play: the players' chosen names. Without them the labels are "You" and "Bot". */
  youName?: string; oppName?: string;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<View>({ round: 0, you: false, bot: false, tie: false, winner: false });
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const { steps, total } = drawTimeline(draws.length);
    const timers = steps.map((s) => setTimeout(() => { setView(s.view); s.sound?.(); }, s.at));
    timers.push(setTimeout(() => done.current(), total));
    return () => timers.forEach(clearTimeout);
  }, [draws]);

  const draw = draws[view.round] ?? draws[0]!;
  const seat = (who: PlayerId, label: string, shown: boolean) => (
    <div className="flex flex-col items-center gap-2">
      <span className={clsx('font-bold', who === 'p1' ? 'text-you' : 'text-bot')}>{label}</span>
      <div className={clsx('rounded-xl p-1 transition', view.winner && starter === who && 'scale-110 ring-4 ring-amber-400')}>
        <Flip shown={shown}><div className="flex h-36 w-28 items-center justify-center">{shown ? <div className="scale-150"><CardView card={draw[who]} /></div> : <Back />}</div></Flip>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50" role="dialog" aria-live="polite">
      <div className="w-[90vw] max-w-md rounded-xl bg-white p-6 text-center shadow-xl">
        <h2 className="mb-5 text-lg font-extrabold sm:text-xl">{t('drawTitle')}</h2>
        <div className="mb-5 flex justify-around">
          {seat('p1', youName ?? t('you'), view.you)}
          {seat('p2', oppName ?? t('bot'), view.bot)}
        </div>
        <p className="min-h-6 font-semibold text-slate-700">
          {view.tie ? t('drawTie') : view.winner ? (starter === 'p1' ? t('drawYouFirst') : oppName ? t('drawFirst', { name: oppName }) : t('drawBotFirst')) : ''}
        </p>
      </div>
    </div>
  );
}
