import { MAX_NAME } from '@tatp/game';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useI18n } from './i18n';

const NAME_KEY = 'tatp.name';

export function loadName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
export function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
}

const btn = 'rounded bg-msn px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50';
const ghost = 'rounded px-3 py-2 text-slate-600 hover:bg-slate-100';

function Modal({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
      <div role="dialog" aria-modal="true" aria-label={label} className="w-[90vw] max-w-sm rounded-xl bg-white p-5 shadow-xl">
        {children}
      </div>
    </div>
  );
}

/** Mode choice shown after the tutorial and on every later visit to the root URL. */
export function MenuModal({ onBot, onRoom }: { onBot: () => void; onRoom?: () => void }) {
  const { t } = useI18n();
  return (
    <Modal label={t('menuTitle')}>
      <h2 className="mb-4 text-center text-lg font-bold">{t('menuTitle')}</h2>
      <div className="flex flex-col gap-2">
        <button className={btn} onClick={onBot} autoFocus>{t('playBot')}</button>
        {onRoom && <button className={btn} onClick={onRoom}>{t('createRoom')}</button>}
      </div>
    </Modal>
  );
}

/** Asks for the display name shown to the opponent. Prefilled from the last session. */
export function NamePrompt({ onSubmit, onBack }: { onSubmit: (name: string) => void; onBack: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(loadName);
  const clean = name.replace(/\s+/g, ' ').trim();
  const submit = (e: FormEvent) => { e.preventDefault(); if (clean) onSubmit(clean); };
  return (
    <Modal label={t('nameTitle')}>
      <form onSubmit={submit}>
        <h2 className="mb-3 text-lg font-bold">{t('nameTitle')}</h2>
        <label className="mb-1 block text-sm text-slate-600" htmlFor="player-name">{t('nameLabel')}</label>
        <input id="player-name" className="mb-1 w-full rounded border border-slate-300 px-3 py-2" value={name} maxLength={MAX_NAME}
          autoFocus autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
        <p className="mb-4 text-xs text-slate-500">{t('nameHint')}</p>
        <div className="flex justify-between gap-2">
          <button type="button" className={ghost} onClick={onBack}>{t('back2')}</button>
          <button type="submit" className={btn} disabled={!clean}>{t('nameGo')}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Shown to the room creator until the friend joins: the link, copy/share, and "waiting…". */
export function RoomModal({ url, offline, onLeave }: { url: string; offline: boolean; onLeave: () => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    input.current?.select();
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* selected: the user can copy by hand */ }
  };
  const share = () => { void navigator.share({ title: t('title'), text: t('roomShareText'), url }).catch(() => { /* dismissed */ }); };

  return (
    <Modal label={t('roomTitle')}>
      <h2 className="mb-1 text-lg font-bold">{t('roomTitle')}</h2>
      <p className="mb-3 text-sm text-slate-600">{t('roomShareHint')}</p>
      <label className="mb-1 block text-xs text-slate-500" htmlFor="room-link">{t('roomLink')}</label>
      <input id="room-link" ref={input} readOnly value={url} onFocus={(e) => e.currentTarget.select()}
        className="mb-3 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm" />
      <div className="mb-4 flex gap-2">
        <button className={btn + ' flex-1'} onClick={copy}>{copied ? t('copied') : t('copy')}</button>
        {canShare && <button className={btn + ' flex-1'} onClick={share}>{t('share')}</button>}
      </div>
      <p className="mb-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-700" aria-live="polite">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-msn" />
        {offline ? t('reconnecting') : t('waitingFriend')}
      </p>
      <div className="text-right"><button className={ghost} onClick={onLeave}>{t('cancel')}</button></div>
    </Modal>
  );
}

/** A title, a line of text and one button. Used for room errors, "room closed" and "connecting…". */
export function NoticeModal({ title, body, action, onAction }: { title: string; body?: string; action: string; onAction: () => void }) {
  return (
    <Modal label={title}>
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      {body && <p className="mb-4 text-sm text-slate-700">{body}</p>}
      <div className="text-right"><button className={btn} onClick={onAction} autoFocus>{action}</button></div>
    </Modal>
  );
}
