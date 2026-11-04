import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DragProvider } from './useDrag';
import { I18nProvider } from './i18n';
import { InstallBanner } from './InstallPrompt';
import { registerServiceWorker } from './pwa';
import { UpdateBanner } from './UpdateBanner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider><DragProvider><App /></DragProvider><UpdateBanner /><InstallBanner /></I18nProvider>
  </StrictMode>,
);

registerServiceWorker();
