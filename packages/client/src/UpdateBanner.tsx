import { useEffect, useState } from 'react';
import { useI18n } from './i18n';

const CHECK_EVERY_MS = 5 * 60 * 1000;

/** Polls version.json (never cached) and offers a reload when a newer build has been deployed. Never reloads by itself, so a game in progress is not interrupted. */
export function UpdateBanner() {
  const { t } = useI18n();
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { id } = (await res.json()) as { id?: string };
        if (!stopped && id && id !== __BUILD_ID__) setStale(true);
      } catch { /* offline or blocked: try again later */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    void check();
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  if (!stale) return null;
  return (
    <div role="status" className="fixed inset-x-2 bottom-2 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      <span>{t('updateAvailable')}</span>
      <button className="rounded bg-msn px-3 py-1 font-semibold hover:opacity-90" onClick={() => location.reload()}>{t('reload')}</button>
    </div>
  );
}
