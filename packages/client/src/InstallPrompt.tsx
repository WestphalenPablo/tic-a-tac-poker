import { useEffect, useState } from 'react';
import { useI18n } from './i18n';
import { dismissInstall, requestInstall, useInstall } from './pwa';

/** Header button. Hidden when the app is installed or the browser can't install it. */
export function InstallButton() {
  const { t } = useI18n();
  const { kind } = useInstall();
  if (kind === 'none') return null;
  return <button className="rounded bg-white/25 px-3 py-1 font-semibold hover:bg-white/40" onClick={() => void requestInstall()}>⤓ {t('install')}</button>;
}

/** Self-made prompt: appears a few seconds after load, at most every 14 days once dismissed. */
export function InstallBanner() {
  const { t } = useI18n();
  const { kind, banner } = useInstall();
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = setTimeout(() => setReady(true), 4000); return () => clearTimeout(id); }, []);
  if (kind === 'none' || !banner || !ready) return null;
  return (
    <div data-pad-chrome role="dialog" aria-label={t('install')} className="fixed inset-x-2 top-2 z-10 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      <span className="flex-1">{kind === 'ios' ? t('installIos') : t('installPrompt')}</span>
      {kind === 'native' && <button className="rounded bg-msn px-3 py-1 font-semibold hover:opacity-90" onClick={() => void requestInstall()}>{t('install')}</button>}
      <button aria-label={t('notNow')} title={t('notNow')} className="px-1 text-lg leading-none text-white/70 hover:text-white" onClick={dismissInstall}>×</button>
    </div>
  );
}
