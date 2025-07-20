import React, { useEffect, useState, useCallback } from 'react';
import DashboardHeader from './DashboardHeader';
import './ticketGrid.css';
import LotteryCard from './LotteryCard';
import { DetailsModal } from './DetailsModal';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { toUserFriendlyAddress } from '@tonconnect/sdk';

interface Lottery {
  id: string;
  name: string;
  description: string;
  ticket_price: number;
  end_date: string;
  max_tickets: number;
  tickets_sold: number;
  prize_pool: number;
  image_url: string;
  ticket_price_currency: string;
  winner_id?: string | null;
  winner_username?: string | null;
  winner_first_name?: string | null;
  winner_ticket_number?: number | null;
  random_link?: string | null;
}

interface Ticket {
  id: string;
  number: number;
  isAvailable: boolean;
  owner?: string;
}

interface BuyStatus {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || 'https://starslottery-backend-production.up.railway.app';
}

export const LotteriesPage: React.FC<{ userId: string }> = ({ userId }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTickets, setSelectedTickets] = useState<number[]>([]);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState<boolean>(false);
  const [tab,setTab]=useState<'active'|'finished'|'my'>('active');
  const [details,setDetails]=useState<Lottery|null>(null);
  const [stats, setStats] = useState<{wins:number;tickets:number;active_lotteries:number}>({wins:0,tickets:0,active_lotteries:0});
  const [starsBalance,setStarsBalance]=useState<number|null>(null);
  const [tonRate,setTonRate]=useState<number|null>(null);
  const [walletInput, setWalletInput] = useState<string>('');
  const [buyStatus, setBuyStatus] = useState<BuyStatus>({ status: 'idle' });
  const [showWalletLink, setShowWalletLink] = useState<boolean>(false);

  const wallet = useTonWallet();

  useEffect(() => {
    const updateUserWallet = async (address: string) => {
      if (userId && address) {
        try {
          await fetch(`${getApiUrl()}/users/${userId}/wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ton_wallet_address: address })
          });
          console.log('Wallet address updated on backend:', address);
          setUserWallet(address);
        } catch (error) {
          console.error('Failed to update wallet address on backend', error);
        }
      }
    };

    if (wallet?.account?.address) {
      const friendlyAddress = toUserFriendlyAddress(wallet.account.address);
      updateUserWallet(friendlyAddress);
    }
  }, [wallet, userId]);

  useEffect(() => {
    // Получить кошелек пользователя
    setWalletLoading(true);
    fetch(`${getApiUrl()}/users/${userId}`)
      .then(r => r.json())
      .then(user => {
        setUserWallet(user.ton_wallet_address || null);
        setWalletInput(user.ton_wallet_address || "");
        setWalletLoading(false);
      })
      .catch(() => {
        setUserWallet(null);
        setWalletLoading(false);
      });
    fetch(`${getApiUrl()}/lotteries`)
      .then(r => r.json())
      .then(setLotteries)
      .then(()=>{
        // Load user stats, balance and rate
        Promise.all([
          fetch(`${getApiUrl()}/users/${userId}/stats`).then(r=>r.json()).catch(()=>null),
          fetch(`${getApiUrl()}/users/${userId}/balance`).then(r=>r.json()).catch(()=>null),
          fetch(`${getApiUrl()}/rates/ton_star`).then(r=>r.json()).catch(()=>null)
        ]).then(([statsData,balData,rateData])=>{
          if(statsData) setStats(statsData);
          if(balData) setStarsBalance(balData.stars_balance);
          if(rateData) setTonRate(rateData.ton_to_star);
        });
      })
      .catch(() => setError('Ошибка загрузки лотерей'))
      .finally(() => setLoading(false));
    // Polling
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${getApiUrl()}/lotteries`);
        if (!res.ok) throw new Error('Failed to load lotteries');
        setLotteries(await res.json());
        if (selected) await fetchTickets(selected);
      } catch (err) {
        console.error('Error loading lotteries:', err);
        setError('Ошибка загрузки лотерей');
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [userId]);

  // Обновление баланса звёзд и курса TON→⭐ каждые 5 минут
  useEffect(() => {
    if (!userWallet) return;

    const fetchBalanceAndRate = async () => {
      try {
        const [balData, rateData] = await Promise.all([
          fetch(`${getApiUrl()}/users/${userId}/balance`).then(r => r.json()).catch(() => null),
          fetch(`${getApiUrl()}/rates/ton_star`).then(r => r.json()).catch(() => null)
        ]);
        if (balData && typeof balData.stars_balance === 'number') {
          setStarsBalance(balData.stars_balance);
        }
        if (rateData && typeof rateData.ton_to_star === 'number') {
          setTonRate(rateData.ton_to_star);
        }
      } catch (err) {
        console.error('Failed to refresh balance/rate', err);
      }
    };

    fetchBalanceAndRate(); // первый вызов
    const interval = setInterval(fetchBalanceAndRate, 300_000); // 5 минут
    return () => clearInterval(interval);
  }, [userWallet, userId]);

  // Reload lotteries and, if necessary, tickets
const reload = useCallback(async () => {
  try {
    const res = await fetch(`${getApiUrl()}/lotteries`);
    if (!res.ok) throw new Error('Failed to load lotteries');
    const lots = await res.json();
    setLotteries(lots);
    if (selected) await fetchTickets(selected);
  } catch (err) {
    console.error('Error reloading lotteries:', err);
    setError('Ошибка загрузки лотерей');
  }
}, [selected]);

const fetchTickets = async (lotteryId:string) => {
    const res = await fetch(`${getApiUrl()}/lotteries/${lotteryId}/tickets`);
    const raw = await res.json();
    setTickets(raw.map((t:any)=>({ ...t, number: t.ticket_number })));

  };

  const handleBuy = async (lotteryId: string, ticketNumbers: number[]) => {
    setBuyStatus({ status: 'loading' });
    try {
      const res = await fetch(`${getApiUrl()}/lotteries/${lotteryId}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          username: tgUser.username,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          ticket_numbers: ticketNumbers
        })
      });
      const data = await res.json();
      if (data.ok) {
        setBuyStatus({ status: 'success', message: 'Билеты успешно куплены!' });
        await reload();
        setSelected(null);
        setSelectedTickets([]);
      }
      else setBuyStatus({ status: 'error', message: data.detail || 'Ошибка покупки' });
    } catch (e) {
      setBuyStatus({ status: 'error', message: 'Ошибка соединения' });
    }
  };

  const handleLotterySelect = (lotteryId: string) => {
    // Get selected lottery data
    const selectedLottery = lotteries.find(l => l.id === lotteryId);
  
    // Calculate total price of selected tickets
    const totalPrice = selectedLottery ? selectedTickets.length * selectedLottery.ticket_price : 0;
  
    setSelected(lotteryId);
    setSelectedTickets([]);
    
    // Load tickets for the selected lottery
    const loadTickets = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${getApiUrl()}/lotteries/${lotteryId}/tickets`);
        if (!response.ok) {
          throw new Error('Failed to load tickets');
        }
        const data = await response.json();
        // map backend ticket_number -> number expected by UI
        setTickets(data.map((t: any) => ({ ...t, number: t.ticket_number })));
      } catch (err) {
        console.error('Error loading tickets:', err);
        setError('Failed to load tickets. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadTickets();
  };

  // Получаем user info из Telegram WebApp initData
  let tgUser = { username: '', first_name: '', last_name: '' };
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      tgUser = {
        username: tg.initDataUnsafe.user.username || '',
        first_name: tg.initDataUnsafe.user.first_name || '',
        last_name: tg.initDataUnsafe.user.last_name || ''
      }
    }
  } catch {}

  // Filter active and finished lotteries
  const active = lotteries.filter(l => !l.winner_id);
  const finished = lotteries.filter(l => l.winner_id);

  // Сетка билетов для выбранной лотереи
  const renderTicketGrid = (lottery: Lottery) => {
    const taken = new Set(tickets.map(t => t.number));
    const buttons = [];
    for (let i = 1; i <= lottery.max_tickets; ++i) {
      const owned = taken.has(i);
      const selected = selectedTickets.includes(i);
      buttons.push(
        <button
          key={i}
          className={
            'btn btn-sm ' +
            (owned ? 'btn-secondary' : (selected ? 'ticket-selected' : 'btn-outline-primary'))
          }
          disabled={owned}
          style={{
            aspectRatio: '1',
            minWidth: 0,
            width: '100%',
            fontSize: 12,
            padding: 0,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            letterSpacing: 0,
            borderRadius: 8,
            userSelect: 'none',
            overflow: 'hidden',
            background: owned ? '#333' : '#121212',
             color: owned ? '#666' : '#fff',
             border: owned ? '1.5px solid #555' : '1.5px solid #333',
            whiteSpace: 'nowrap',
          }}
          onClick={() => {
            if (owned) return;
            if (selected) setSelectedTickets(selectedTickets.filter(n => n !== i));
            else setSelectedTickets([...selectedTickets, i]);
          }}
        >
          {owned ? '✖' : i}
        </button>
      );
    }
    return (
      <div>
        <div className="mb-2">Выберите номера билетов:</div>
        <div className="ticket-grid">
          {buttons}
        </div>
        <div className="mt-3">
          <button
            className="buy-btn"
            disabled={selectedTickets.length === 0}
            onClick={() => handleBuy(lottery.id, selectedTickets)}
          >Купить выбранные билеты</button>
          <button className="details-btn ms-2" onClick={()=>{setSelected(null); setSelectedTickets([]);}}>Отмена</button>
        </div>
      </div>
    );
  };

  if (loading) return <div style={{color:'#fff',padding:32}}>Загрузка...</div>;
  if (error) return <div style={{color:'#fff',padding:32}}>Ошибка загрузки лотерей</div>;

  // Header with stats
  const avatarUrl=(window as any).Telegram?.WebApp?.initDataUnsafe?.user?.photo_url||null;

  const headerEl=(
    <DashboardHeader
      avatarUrl={avatarUrl}
      username={tgUser.username}
      stats={stats}
      starsBalance={starsBalance}
      tonToStarRate={tonRate}
      walletAddress={userWallet}
      onConnectWallet={()=>{
        (window as any).TonConnect?.connect&& (window as any).TonConnect.connect();
      }}
      onTopUpStars={()=>{
        window.open('https://t.me/wallet', '_blank');
      }}
    />
  );

  // If user hasn't connected wallet yet
  if (!userWallet) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#232C51'}}>
        <div style={{background:'#fff',borderRadius:20,padding:'32px 24px',maxWidth:360,width:'100%',boxShadow:'0 8px 32px #232C5140',textAlign:'center'}}>
          <div style={{fontWeight:700,fontSize:24,color:'#244',marginBottom:8}}>Привяжите TON-кошелёк</div>
          <div style={{fontSize:15,marginBottom:16,color:'#444'}}>Для получения выигрыша подключите свой TON Wallet через Telegram.<br/>Вы всегда сможете изменить его позже.</div>
          <TonConnectButton />
        </div>
      </div>
    );
  }

  // helper
  const mapLot=(lot:Lottery)=>({
    id:lot.id,
    name:lot.name,
    description:lot.description,
    prizePoolStars:lot.ticket_price*lot.max_tickets,
    tonToStarRate:tonRate,
    ticketsSold:lot.tickets_sold,
    maxTickets:lot.max_tickets,
    ticketPrice:lot.ticket_price,
    participants:(lot as any).participants ?? lot.tickets_sold,
    endDate:lot.end_date,
    randomLink:lot.random_link||undefined,
    onBuy:()=>handleLotterySelect(lot.id),
    onDetails:()=>setDetails(lot)
  });

  // Tabs arrays
  const activeLots = lotteries.filter(l=>!l.winner_id);
  const finishedLots = lotteries.filter(l=>l.winner_id);
  const participatedLots = lotteries.filter(l=>tickets.some(t=>t.owner===tgUser.username));
  const wonLots = lotteries.filter(l=>l.winner_id===userId);
  
  

  // If a lottery is selected, show ticket grid overlay
  if (selected) {
    const lot = lotteries.find(l => l.id === selected);
    if (lot) {
      return (
        <div style={{minHeight:'100vh',background:'#000',color:'#fff',padding:'24px'}}>
          <button className="btn btn-link mb-3" onClick={()=>{setSelected(null);}} style={{color:'#7CD6FF'}}>&larr; Назад</button>
          <h3 style={{fontWeight:700,marginBottom:16}}>{lot.name}</h3>
          {renderTicketGrid(lot)}
        </div>
      );
    }
  }

  return (
    <div style={{minHeight:'100vh',background:'#000',paddingBottom:40}}>
      {headerEl}
      {/* Tabs */}
      <div className="tabs-bar" style={{display:'flex',gap:8,margin:'0 16px 16px'}}>
        {['active','finished','my'].map(t=>(
          <button key={t} onClick={()=>setTab(t as any)} className="tab-btn" style={{flex:1,padding:8,borderRadius:8,border:'none',background:tab===t?'#7C5CFF':'#222',color:'#fff'}}>{t==='active'?'Активные':t==='finished'?'Завершённые':'Мои'}</button>
        ))}
      </div>

      {/* List of lotteries */}
      <div style={{padding:'0 16px'}}>
        {tab === 'active' && (
          <>
            {activeLots.length === 0 && <div style={{color:'#666',padding:8}}>Нет активных лотерей</div>}
            {activeLots.map(lot => (
              <LotteryCard key={lot.id} {...mapLot(lot)} status="active" canBuy={!!userWallet} />
            ))}
          </>
        )}
        {tab === 'finished' && (
          <>
            {finishedLots.length === 0 && <div style={{color:'#666',padding:8}}>Нет завершённых лотерей</div>}
            {finishedLots.map(lot => (
              <LotteryCard key={lot.id} {...mapLot(lot)} status="finished" canBuy={false} />
            ))}
          </>
        )}
        {tab === 'my' ? (
          <>
            {wonLots.length > 0 && (
              <>
                <h4 style={{color:'#7CFF7C',margin:'8px 0'}}>Победил</h4>
                {wonLots.map((lot) => (
                  <LotteryCard key={lot.id} {...mapLot(lot)} status="finished" canBuy={false} />
                ))}
              </>
            )}
            {participatedLots.length > 0 && (
              <>
                <h4 style={{color:'#fff',margin:'8px 0'}}>Участвовал</h4>
                {participatedLots.map(lot => (
                  <LotteryCard key={lot.id} {...mapLot(lot)} status={lot.winner_id ? 'finished' : 'active'} canBuy={!lot.winner_id && !!userWallet} />
                ))}
              </>
            )}
          </>
        ) : null}
      </div>
      <DetailsModal
        visible={!!details}
        title={details?.name || ''}
        onClose={()=>setDetails(null)}
      >
        <p>{details?.description}</p>
        <p>Условиями участия вы подтверждаете согласие на обработку персональных данных и принимаете пользовательское соглашение.</p>
      </DetailsModal>


    </div>
  );
}
