import type { DeckCard } from '@tatp/game';
import clsx from 'clsx';
import { useI18n } from './i18n';

const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' } as const;
const RED = new Set(['H', 'D']);

export function CardView({
  card, selected, onClick, small, focused, drag,
}: {
  card: DeckCard | null; selected?: boolean; onClick?: () => void; small?: boolean; focused?: boolean;
  /** Makes the card draggable / a drop target. */
  drag?: { onDragStart?: () => void; onDrop?: () => void; onDragEnd?: () => void };
}) {
  const { t } = useI18n();
  // Compact on phones (<640px), original sizes from sm up.
  const size = small ? 'h-16 w-11 text-base sm:h-20 sm:w-14 sm:text-xl' : 'h-[4.5rem] w-12 text-lg sm:h-24 sm:w-[4.25rem] sm:text-2xl';
  const base = clsx(
    'relative flex flex-col items-start justify-between rounded-lg border p-1 sm:p-1.5 font-bold leading-none select-none',
    size, onClick && 'cursor-pointer transition hover:-translate-y-0.5', selected && 'ring-4 ring-msn', focused && 'outline outline-4 outline-offset-2 outline-fuchsia-500',
    drag?.onDragStart && 'cursor-grab active:cursor-grabbing',
  );
  const dnd = {
    onClick,
    draggable: !!drag?.onDragStart,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); drag?.onDragStart?.(); },
    onDragEnd: drag?.onDragEnd,
    onDragOver: drag?.onDrop ? (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } : undefined,
    onDrop: drag?.onDrop ? (e: React.DragEvent) => { e.preventDefault(); drag.onDrop!(); } : undefined,
  };
  if (card === null) return <div className={clsx(base, 'border-dashed border-sky-200 bg-sky-50/60')} {...dnd} />;
  if (card === 'ROBBER')
    return <div className={clsx(base, 'items-center justify-center border-slate-700 bg-slate-800 text-2xl sm:text-3xl')} {...dnd}>🦹<span className="text-[10px] font-semibold text-white">{t('robber')}</span></div>;
  if (card === 'JOKER')
    return <div className={clsx(base, 'items-center justify-center border-fuchsia-400 bg-gradient-to-br from-fuchsia-100 to-amber-100 text-2xl sm:text-3xl')} {...dnd}>🃏<span className="text-[10px] font-semibold text-fuchsia-700">{t('joker')}</span></div>;
  return (
    <div
      className={clsx(base, 'bg-white shadow-sm', RED.has(card.suit) ? 'text-red-600' : 'text-slate-900', card.joker ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-slate-300')}
      {...dnd}
    >
      <span>{card.rank}</span>
      <span className="self-end text-2xl sm:text-3xl">{SUIT[card.suit]}</span>
      {card.joker && <span className="absolute right-1 top-0.5 text-xs">🃏</span>}
    </div>
  );
}
