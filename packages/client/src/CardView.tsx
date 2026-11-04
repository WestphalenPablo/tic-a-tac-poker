import type { DeckCard } from '@tatp/game';
import clsx from 'clsx';
import { useI18n } from './i18n';

const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' } as const;
const RED = new Set(['H', 'D']);

export function CardView({
  card, selected, onClick, small,
}: { card: DeckCard | null; selected?: boolean; onClick?: () => void; small?: boolean }) {
  const { t } = useI18n();
  const size = small ? 'h-20 w-14 text-xl' : 'h-24 w-[4.25rem] text-2xl';
  const base = clsx(
    'relative flex flex-col items-start justify-between rounded-lg border p-1.5 font-bold leading-none select-none',
    size, onClick && 'cursor-pointer transition hover:-translate-y-0.5', selected && 'ring-4 ring-msn',
  );
  if (card === null) return <div className={clsx(base, 'border-dashed border-sky-200 bg-sky-50/60')} onClick={onClick} />;
  if (card === 'ROBBER')
    return <div className={clsx(base, 'items-center justify-center border-slate-700 bg-slate-800 text-3xl')} onClick={onClick}>🦹<span className="text-[10px] font-semibold text-white">{t('robber')}</span></div>;
  if (card === 'JOKER')
    return <div className={clsx(base, 'items-center justify-center border-fuchsia-400 bg-gradient-to-br from-fuchsia-100 to-amber-100 text-3xl')} onClick={onClick}>🃏<span className="text-[10px] font-semibold text-fuchsia-700">{t('joker')}</span></div>;
  return (
    <div
      className={clsx(base, 'bg-white shadow-sm', RED.has(card.suit) ? 'text-red-600' : 'text-slate-900', card.joker ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-slate-300')}
      onClick={onClick}
    >
      <span>{card.rank}</span>
      <span className="self-end text-3xl">{SUIT[card.suit]}</span>
      {card.joker && <span className="absolute right-1 top-0.5 text-xs">🃏</span>}
    </div>
  );
}
