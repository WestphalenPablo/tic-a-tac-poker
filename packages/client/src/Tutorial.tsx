import { POINTS, type DeckCard, type HandType, type Rank, type Suit } from '@tatp/game';
import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import { CardView } from './CardView';
import { useI18n, type Key } from './i18n';
import { useGamepad } from './useGamepad';

const STORAGE_KEY = 'tatp.tutorialSeen';

export function seenTutorial(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
export function markTutorialSeen() {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
}

const c = (rank: Rank, suit: Suit): DeckCard => ({ rank, suit });
const HANDS: HandType[] = ['PAIR', 'FLUSH', 'STRAIGHT', 'THREE_OF_A_KIND', 'STRAIGHT_FLUSH', 'ROYAL_FLUSH'];

const row = (children: ReactNode) => <div className="flex justify-center gap-1.5">{children}</div>;

function Visual({ step }: { step: number }) {
  const { t, lang } = useI18n();
  switch (step) {
    case 0:
      return row([c('A', 'S'), c('K', 'S'), c('Q', 'S')].map((x, i) => <CardView key={i} small card={x} />));
    case 1:
      return row(<>
        <CardView small card={c('7', 'H')} selected />
        <span className="self-center text-2xl text-slate-400">→</span>
        <CardView small card={null} />
      </>);
    case 2:
      return (
        <table className="mx-auto text-sm">
          <tbody>
            {HANDS.map((h) => (
              <tr key={h}><td className="pr-4 text-left">{t(`hand.${h}`)}</td><td className="text-right font-mono font-bold">{POINTS[h].toLocaleString(lang)}</td></tr>
            ))}
          </tbody>
        </table>
      );
    case 3:
      return row(<>
        <CardView small card={{ rank: 'A', suit: 'S', joker: true }} />
        <CardView small card="JOKER" />
        <CardView small card="ROBBER" />
      </>);
    default:
      return row([c('K', 'D'), c('9', 'C')].map((x, i) => <CardView key={i} small card={x} />));
  }
}

const STEPS: { title: Key; body: Key }[] = [
  { title: 'tut1Title', body: 'tut1Body' },
  { title: 'tut2Title', body: 'tut2Body' },
  { title: 'tut3Title', body: 'tut3Body' },
  { title: 'tut4Title', body: 'tut4Body' },
  { title: 'tut5Title', body: 'tut5Body' },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const next = () => (last ? onClose() : setStep(step + 1));
  const back = () => setStep(Math.max(0, step - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useGamepad((a) => {
    if (a === 'a' || a === 'right') next();
    else if (a === 'left') back();
    else if (a === 'b') (step === 0 ? onClose() : back());
  });

  const s = STEPS[step]!;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('howToPlay')} className="w-[90vw] max-w-sm rounded-xl bg-white p-4 shadow-xl sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold">{t(s.title)}</h2>
          <button aria-label={t('skip')} title={t('skip')} onClick={onClose} className="rounded px-2 text-xl leading-none text-slate-400 hover:bg-slate-100">×</button>
        </div>
        <div className="mb-3 flex min-h-28 items-center justify-center rounded-lg bg-sky-50 p-3"><Visual step={step} /></div>
        <p className="mb-4 text-sm text-slate-700">{t(s.body)}</p>
        <div className="mb-4 flex justify-center gap-1.5">
          {STEPS.map((_, i) => <span key={i} className={clsx('h-2 w-2 rounded-full', i === step ? 'bg-msn' : 'bg-slate-300')} />)}
        </div>
        <div className="flex justify-between gap-2">
          <button onClick={back} disabled={step === 0} className="rounded px-3 py-1.5 text-slate-600 hover:bg-slate-100 disabled:invisible">{t('back')}</button>
          <button onClick={next} className="rounded bg-msn px-4 py-1.5 font-semibold text-white hover:bg-sky-700">{last ? t('letsPlay') : t('next')}</button>
        </div>
      </div>
    </div>
  );
}
