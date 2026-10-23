import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import '@fontsource-variable/fraunces/soft.css';
import 'katex/dist/katex.min.css';
import './ui/styles/app.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support: production builds only (dev has no service worker).
if (import.meta.env.PROD) registerSW({ immediate: true });
