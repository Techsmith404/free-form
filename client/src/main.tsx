import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { RealtimeProvider } from './context/RealtimeContext.js';
import { initServerUrl } from './api/index.js';
import { initNativeApp } from './services/native.js';
import './index.css';

async function bootstrap() {
  try {
    await initServerUrl();
    await initNativeApp();
  } catch (err) {
    console.error('Failed to initialize app settings:', err);
  }

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
}

bootstrap();

