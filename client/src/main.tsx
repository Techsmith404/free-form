import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { RealtimeProvider } from './context/RealtimeContext.js';
import { initServerUrl } from './api/index.js';
import { initNativeApp } from './services/native.js';
import './index.css';

// Initialize native app features and custom server URL
initServerUrl().then(() => {
  initNativeApp();
});

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration error:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RealtimeProvider>
      <App />
    </RealtimeProvider>
  </React.StrictMode>
);

