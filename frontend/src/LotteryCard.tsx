import React from 'react';
import './lotteryCard.css';

interface LotteryCardProps {
  randomLink?: string;
  id: string;
  name: string;
  description?: string;
  prizePoolStars: number;
  tonToStarRate: number | null;
  ticketsSold: number;
  maxTickets: number;
  ticketPrice: number;
  participants: number;
  endDate: string;
  onBuy: (lotteryId: string) => void;
  onDetails: (lotteryId: string) => void;
  canBuy:boolean;
  status?: 'active' | 'finished' | 'my';
}

const LotteryCard: React.FC<LotteryCardProps> = ({
  id,
  name,
  description,
  prizePoolStars,
  tonToStarRate,
  ticketsSold,
  maxTickets,
  ticketPrice,
  participants,
  endDate,
  onBuy,
  onDetails,
  status = 'active',
  randomLink,
  canBuy,
}) => {
  const percent = Math.min(100, Math.round((ticketsSold / maxTickets) * 100));
  const daysLeft = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const tonEquivalent = tonToStarRate ? Math.round((prizePoolStars / tonToStarRate) * 100) / 100 : null;

  return (
    <div className="lottery-card-new">
      <div className="header-row">
        <h3>{name}</h3>
        {status === 'active' && <span className="status-active">Активна</span>}
        {status === 'finished' && <span className="status-finished">Завершена</span>}
      </div>
      {description && <p className="description">{description}</p>}

      <div className="fund-block">
        <span>Призовой фонд</span>
        <span className="fund-value">{prizePoolStars} ⭐{tonEquivalent && `  (${tonEquivalent} TON)`}</span>
      </div>

      <div className="progress-row">
        Продано билетов
        <div className="progress-bar"><div style={{width:`${percent}%`}}></div></div>
        <span>{ticketsSold} / {maxTickets}</span>
      </div>

      <div className="meta-row">
        <span>Цена билета: <b>{ticketPrice}</b> ⭐</span>
        <span>Участников: <b>{participants}</b></span>
      </div>

      <div className="meta-row">
        {percent >= 90 ? (
          <span>Осталось: <b>{daysLeft} дн.</b></span>
        ): (
          <span>Минимальный выкуп не выполнен</span>
        )}
      </div>

      {randomLink && status==='finished' && (
        <div style={{fontSize:12,marginTop:4}}><a href={randomLink} target="_blank" rel="noopener noreferrer">random.org</a></div>
      )}

      <div className="actions-row">
        {canBuy && <button className="buy-btn" onClick={()=>onBuy(id)}>Купить билет</button>}
        <button className="details-btn" onClick={()=>onDetails(id)}>Подробнее</button>
      </div>
    </div>
  );
};

export default LotteryCard;
