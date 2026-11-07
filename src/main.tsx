import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Polyfill for libraries that reference process.env in browser (e.g. @react-pdf/renderer)
// Must be set before any lazy imports resolve
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).process = (window as any).process ?? { env: { NODE_ENV: 'production' } };

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);