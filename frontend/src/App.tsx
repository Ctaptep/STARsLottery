import React from 'react';

import { LotteriesPage } from './LotteriesPage';

type AppProps = { userId: number | null };

const App: React.FC<AppProps> = ({ userId }) => {
  const isTelegramWebApp = typeof window !== 'undefined' && !!window.Telegram && !!window.Telegram.WebApp;
  if (!isTelegramWebApp) {
    return <div style={{padding: 32, textAlign: 'center', fontSize: 20}}>
      Пожалуйста, откройте это приложение через <b>Telegram Mini App</b>.<br/>
      (Перейдите по кнопке в Telegram-боте)
    </div>;
  }
  if (userId == null) return <div>Ошибка авторизации</div>;
  return <LotteriesPage userId={userId} />;
};

export default App;
