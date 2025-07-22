import React, { useState } from 'react';
import './dashboardHeader.css';

interface Stats {
  wins: number;
  tickets: number;
  active_lotteries: number;
}

interface Props {
  avatarUrl: string | null;
  username: string;
  stats: Stats;
  starsBalance: number | null; // null = not connected wallet
  tonToStarRate: number | null; // null = loading
  walletAddress: string | null;
  walletBalanceTon: number | null;
  onConnectWallet: () => void;
  onTopUpStars: () => void;
}

const DashboardHeader: React.FC<Props> = ({
  avatarUrl,
  username,
  stats,
  starsBalance,
  tonToStarRate,
  walletAddress,
  walletBalanceTon,
  onConnectWallet,
  onTopUpStars,
}) => {
  const renderWalletSection = () => {
    if (!walletAddress) {
      return (
        <button className="wallet-connect" onClick={onConnectWallet}>
          Подключить TON-кошелёк
        </button>
      );
    }
    return (
      <div className="wallet-connected">
        <span className="wallet-address">Адрес: {walletAddress.slice(0,6)}…{walletAddress.slice(-4)} | Баланс: {walletBalanceTon!==null?walletBalanceTon+' TON':'...'}</span>
      </div>
    );
  };

  const renderStars = () => {
    if (!walletAddress) return null;
    return (
      <button className="topup-link" onClick={onTopUpStars}>Купить ⭐</button>
    );
  };

  const [showRateDlg, setShowRateDlg] = useState(false);

  return (
    <div className="dashboard-header">
      <div className="user-row">
        {avatarUrl && <img src={avatarUrl} alt="avatar" className="avatar" />}
        <span className="username">@{username || 'anonymous'}</span>
        <div className="stars-balance">
          {renderStars()}
          {tonToStarRate !== null && (
            <span className="rate-link" onClick={() => setShowRateDlg(true)} style={{cursor:'pointer'}}>
              Курс: 1 TON ≈ {tonToStarRate} ⭐
            </span>
          )}
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{stats.wins}</div>
          <div className="stat-label">Побед</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.tickets}</div>
          <div className="stat-label">Билетов</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.active_lotteries}</div>
          <div className="stat-label">Активных</div>
        </div>
      </div>

      <div className="wallet-row">
        {renderWalletSection()}
      </div>
      {showRateDlg && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={()=>setShowRateDlg(false)}>
          <div style={{background:'#1d1d1d',padding:20,borderRadius:8,boxShadow:'0 0 10px #000',minWidth:260}} onClick={e=>e.stopPropagation()}>
            <h4 style={{margin:'0 0 12px',color:'#fff',fontSize:16}}>Ссылки по курсу</h4>
            <button className="btn btn-primary btn-sm" style={{width:'100%',marginBottom:8}} onClick={()=>window.Telegram?.WebApp?.openTelegramLink?.('https://t.me/PremiumBot')}>💎 @PremiumBot</button>
            <button className="btn btn-secondary btn-sm" style={{width:'100%'}} onClick={()=>window.open('https://www.coingecko.com/en/coins/toncoin','_blank')}>📈 Биржа TON</button>
            <button className="btn btn-link btn-sm" style={{marginTop:8,color:'#bbb'}} onClick={()=>setShowRateDlg(false)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
