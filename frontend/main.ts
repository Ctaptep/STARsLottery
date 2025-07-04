// Vite + TypeScript entrypoint for Telegram Mini App "Лотерея"

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { AdminPanel } from './src/admin';

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
    React.createElement(React.StrictMode, null,
      isAdmin ? React.createElement(AdminPanel) : React.createElement(App, { userId })
    )
  );
}

