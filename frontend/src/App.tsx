import React from 'react';
import { LotteriesPage } from './LotteriesPage';

type AppProps = { userId: string | null };

const App: React.FC<AppProps> = ({ userId }) => {
  if (!userId) {
    return (
      <div style={{padding: 32, textAlign: 'center', fontSize: 20}}>
        Пожалуйста, откройте это приложение через <b>Telegram Mini App</b>.<br/>
        (Перейдите по кнопке в Telegram-боте)
      </div>
    );
  }
  
  return <LotteriesPage userId={userId} />;
};

export default App;
