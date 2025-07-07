import React, { useEffect } from 'react';
import { LotteriesPage } from './LotteriesPage';
import { initTelegramWebApp, isTelegramInitialized } from './tonConnect';

type AppProps = { userId: string | null };

const App: React.FC<AppProps> = ({ userId }) => {
  useEffect(() => {
    // Initialize Telegram WebApp when component mounts
    initTelegramWebApp();
  }, []);

  const isTelegramWebApp = isTelegramInitialized;
  
  if (!isTelegramWebApp) {
    return (
      <div style={{padding: 32, textAlign: 'center', fontSize: 20}}>
        Пожалуйста, откройте это приложение через <b>Telegram Mini App</b>.<br/>
        (Перейдите по кнопке в Telegram-боте)
      </div>
    );
  }
  
  if (!userId) {
    return <div>Ошибка авторизации. Пожалуйста, войдите через Telegram.</div>;
  }
  
  return <LotteriesPage userId={userId} />;
};

export default App;
