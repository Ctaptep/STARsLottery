import React from 'react';
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
        <span className="wallet-address">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
      </div>
    );
  };

  const renderStars = () => {
    if (walletAddress === null) return <span>—</span>;
    if (starsBalance === null) return <span>…</span>;
    return (
      <>
        {starsBalance} ⭐{' '}
        <button className="topup-link" onClick={onTopUpStars}>пополнить</button>
      </>
    );
  };

  return (
    <div className="dashboard-header">
      <div className="user-row">
        {avatarUrl && <img src={avatarUrl} alt="avatar" className="avatar" />}
        <span className="username">@{username || 'anonymous'}</span>
        <div className="stars-balance">
          {renderStars()}
          {tonToStarRate !== null && (
            <span className="rate">Курс: 1 TON ≈ {tonToStarRate} ⭐</span>
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
    </div>
  );
};

export default DashboardHeader;
