import '@fontsource/anuphan/thai-600.css';
import '@fontsource/anuphan/latin-600.css';
import '@fontsource/ibm-plex-sans-thai/thai-400.css';
import '@fontsource/ibm-plex-sans-thai/latin-400.css';
import '@fontsource/ibm-plex-sans-thai/thai-600.css';
import '@fontsource/ibm-plex-sans-thai/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './theme/tokens.css';
import './theme/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { env } from './config/env';
import { ErrorBoundary } from './shared/ErrorBoundary';

document.title = env.VITE_APP_NAME;
document.documentElement.lang = env.VITE_DEFAULT_LOCALE;
if (env.VITE_DEFAULT_THEME !== 'system') {
  document.documentElement.dataset.theme = env.VITE_DEFAULT_THEME;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
