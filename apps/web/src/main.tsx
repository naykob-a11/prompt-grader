import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { env } from './config/env';

document.title = env.VITE_APP_NAME;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
