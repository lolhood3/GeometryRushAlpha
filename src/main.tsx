import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against benign cross-origin frame access errors from parent iframe inspectors
if (typeof window !== 'undefined') {
  const isCrossOrigin = (err: unknown): boolean => {
    if (!err) return false;
    const str = typeof err === 'string' ? err : String((err as { message?: string })?.message || err);
    return (
      str.includes('cross-origin') ||
      str.includes('Blocked a frame') ||
      str.includes('SecurityError') ||
      str.includes('$$typeof') ||
      str.includes('Protocols, domains, and ports must match')
    );
  };

  window.addEventListener(
    'error',
    (event) => {
      if (isCrossOrigin(event.message) || isCrossOrigin(event.error)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isCrossOrigin(event.reason)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
