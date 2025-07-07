// Vite + TypeScript entrypoint for Telegram Mini App "Лотерея"

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { AdminPanel } from './src/admin';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

const manifestUrl = 'https://starslottery-fronend-production.up.railway.app/tonconnect-manifest.json';

const isAdmin = window.location.pathname.startsWith('/admin');

let userId: number | null = null;
if (!isAdmin) {
  // Only for Telegram Mini App user flow
  const tg = (window as any).Telegram?.WebApp;
  userId = tg?.initDataUnsafe?.user?.id ?? null;
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <TonConnectUIProvider manifestUrl={manifestUrl}>
        {isAdmin ? <AdminPanel /> : <App userId={userId?.toString() ?? null} />}
      </TonConnectUIProvider>
    </React.StrictMode>
  );
}

