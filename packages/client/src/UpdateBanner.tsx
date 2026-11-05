import { useEffect, useState } from 'react';
import { useI18n } from './i18n';
import { commitsSince, type Commit } from './releaseNotes';

const CHECK_EVERY_MS = 5 * 60 * 1000;

/** Polls version.json (never cached). When a newer build is deployed, shows a banner whose View button opens the release notes; only that modal offers the reload. Never reloads by itself, so a game in progress is not interrupted. */
export function UpdateBanner() {
  const { t } = useI18n();
  const [commits, setCommits] = useState<Commit[] | null>(null); // non-null = a newer build exists
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const v = (await res.json()) as { id?: string; commits?: Commit[] };
        if (!stopped && v.id && v.id !== __BUILD_ID__) setCommits(Array.isArray(v.commits) ? v.commits : []);
      } catch { /* offline or blocked: try again later */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    void check();
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!commits) return null;
  const added = commitsSince(commits, __BUILD_COMMIT__);
  return (
    <>
      <div data-pad-chrome role="status" className="fixed inset-x-2 bottom-2 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
        <span>{t('updateAvailable')}</span>
        <button className="rounded bg-msn px-3 py-1 font-semibold hover:opacity-90" onClick={() => setOpen(true)}>{t('viewUpdate')}</button>
      </div>
      {open && (
        <div data-pad-scope className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={t('whatsNew')} className="w-[90vw] max-w-sm rounded-xl bg-white p-5 text-slate-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-lg font-bold">{t('whatsNew')}</h2>
            {added.length ? (
              <ul className="mb-4 max-h-[50vh] list-disc space-y-1 overflow-y-auto pl-5 text-sm">
                {added.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            ) : <p className="mb-4 text-sm">{t('updateGeneric')}</p>}
            <div className="flex justify-end gap-2">
              <button data-pad-cancel className="rounded px-3 py-2 text-slate-600 hover:bg-slate-100" onClick={() => setOpen(false)}>{t('notNow')}</button>
              <button className="rounded bg-msn px-4 py-2 font-semibold text-white hover:opacity-90" onClick={() => location.reload()} data-pad-default>{t('updateNow')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
