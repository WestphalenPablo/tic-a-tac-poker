import { RANKS, SUITS, type Rank, type Suit } from '@tatp/game';
import clsx from 'clsx';
import { useState } from 'react';
import { CardView } from './CardView';
import { useI18n } from './i18n';
import { useGamepad } from './useGamepad';

const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' } as const;

export function JokerPicker({ onConfirm, onCancel }: { onConfirm: (as: { rank: Rank; suit: Suit }) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [rank, setRank] = useState<Rank>('A');
  const [suit, setSuit] = useState<Suit>('S');
  useGamepad((a) => {
    const step = (d: number) => setRank(RANKS[(RANKS.indexOf(rank) + d + RANKS.length) % RANKS.length]!);
    const sstep = (d: number) => setSuit(SUITS[(SUITS.indexOf(suit) + d + SUITS.length) % SUITS.length]!);
    if (a === 'left') step(-1); else if (a === 'right') step(1);
    else if (a === 'up') sstep(-1); else if (a === 'down') sstep(1);
    else if (a === 'a') onConfirm({ rank, suit }); else if (a === 'b') onCancel();
  });
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-lg font-bold">{t('jokerTitle')}</h2>
        <div className="mb-3 flex justify-center"><CardView card={{ rank, suit, joker: true }} /></div>
        <div className="mb-3 flex justify-center gap-2">
          {SUITS.map((s) => (
            <button key={s} onClick={() => setSuit(s)} className={clsx('h-10 w-10 rounded border text-2xl', s === 'H' || s === 'D' ? 'text-red-600' : '', suit === s ? 'border-msn bg-sky-100' : 'border-slate-300')}>{SUIT[s]}</button>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap justify-center gap-1">
          {RANKS.map((r) => (
            <button key={r} onClick={() => setRank(r)} className={clsx('h-9 w-9 rounded border text-sm font-semibold', rank === r ? 'border-msn bg-sky-100' : 'border-slate-300')}>{r}</button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded px-3 py-1.5 text-slate-600 hover:bg-slate-100">{t('cancel')}</button>
          <button onClick={() => onConfirm({ rank, suit })} className="rounded bg-msn px-4 py-1.5 font-semibold text-white hover:bg-sky-700">{t('confirm')}</button>
        </div>
      </div>
    </div>
  );
}
