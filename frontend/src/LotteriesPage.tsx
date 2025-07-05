import React, { useEffect, useState } from 'react';
import './ticketGrid.css';
import { tonConnect, getWalletFromTelegram } from './tonConnect';

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

function getApiUrl() {
  return import.meta.env.VITE_API_URL || 'http://localhost:8000';
}

type Lottery = {
  id: number;
  name: string;
  ticket_price: number;
  max_tickets: number;
  tickets_sold: number;
  winner_id?: number | null;
  winner_ticket_number?: number | null;
  random_link?: string | null;
};

export const LotteriesPage: React.FC<{ userId: number }> = ({ userId }) => {
  const [lotteries, setLotteries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyStatus, setBuyStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTickets, setSelectedTickets] = useState<number[]>([]);

  // --- TON WALLET STATE ---
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletInput, setWalletInput] = useState<string>('');
  const [showWalletLink, setShowWalletLink] = useState(false);

  // Подключение TON-кошелька через Telegram
  async function connectTonWallet() {
    setWalletLoading(true);
    setShowWalletLink(false);
    console.log('[TON] connectTonWallet called');
    
    try {
      console.log('[TON] Starting Telegram Wallet connection...');
      
      // First, try to get wallet from Telegram WebApp
      const telegramWallet = await getWalletFromTelegram();
      
      if (telegramWallet) {
        console.log('[TON] Found wallet in Telegram WebApp:', telegramWallet);
        const walletAddress = telegramWallet.account.address;
        setUserWallet(walletAddress);
        
        // Save to backend
        try {
          console.log('[TON] Saving wallet to backend...');
          const response = await fetch(`${getApiUrl()}/users/${userId}/wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ton_wallet_address: walletAddress })
          });
          
          if (!response.ok) {
            throw new Error(`Backend error: ${response.status} ${response.statusText}`);
          }
          
          console.log('[TON] Wallet saved successfully');
          alert('TON-кошелек успешно подключён и сохранён!');
          return;
        } catch (e) {
          console.error('[TON] Error saving wallet to backend:', e);
          alert('Ошибка при сохранении кошелька. Пожалуйста, попробуйте ещё раз.');
          return;
        }
      }
      
      // If wallet not found in WebApp, try to open it
      console.log('[TON] Wallet not found in WebApp, trying to open...');
      
      // Open Telegram Wallet
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink('https://t.me/wallet');
      } else {
        window.open('https://t.me/wallet', '_blank');
      }
      
      // Show message to user
      setShowWalletLink(true);
      alert('Пожалуйста, создайте или разблокируйте кошелек в открывшемся окне, затем вернитесь и нажмите "Подключить TON-кошелёк" снова.');
      
    } catch (e) {
      console.error('[TON] Connection error:', e);
      setShowWalletLink(true);
      alert('Ошибка подключения к TON-кошельку. Пожалуйста, попробуйте ещё раз.');
    } finally {
      setWalletLoading(false);
    }
  }

  // Получаем user info из Telegram WebApp initData
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
      .catch(() => setError('Ошибка загрузки лотерей'))
      .finally(() => setLoading(false));
    // Polling
    const poll = setInterval(() => {
      reload();
    }, 3000);
    return () => clearInterval(poll);
  }, [userId]);

  const reload = () => {
    fetch(`${getApiUrl()}/lotteries`)
      .then(r => r.json())
      .then(setLotteries);
    if (selected) fetchTickets(selected);
  };

  const fetchTickets = async (lotteryId:number) => {
    const res = await fetch(`${getApiUrl()}/tickets?lottery_id=${lotteryId}`);
    setTickets(await res.json());
  };

  const handleBuy = async (lotteryId: number, ticketNumbers: number[]) => {
    setBuyStatus(null);
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
      if (data.ok) { setBuyStatus('Билеты успешно куплены!'); reload(); setSelected(null); setSelectedTickets([]); }
      else setBuyStatus(data.detail || 'Ошибка покупки');
    } catch (e) {
      setBuyStatus('Ошибка соединения');
    }
  };

  // Разделение активных и завершённых лотерей
  const active = lotteries.filter(l => !l.winner_id);
  const finished = lotteries.filter(l => l.winner_id);

  // Сетка билетов для выбранной лотереи
  const renderTicketGrid = (lottery:any) => {
    const taken = new Set(tickets.map(t => t.ticket_number));
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
            background: '#fff',
            border: '1.5px solid #3B4271',
            color: '#232C51',
            whiteSpace: 'nowrap',
          }}
          onClick={() => {
            if (owned) return;
            if (selected) setSelectedTickets(selectedTickets.filter(n => n !== i));
            else setSelectedTickets([...selectedTickets, i]);
          }}
        >
          {i}
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
            className="btn btn-primary"
            disabled={selectedTickets.length === 0}
            onClick={() => handleBuy(lottery.id, selectedTickets)}
          >Купить выбранные билеты</button>
          <button className="btn btn-link ms-2" onClick={()=>{setSelected(null); setSelectedTickets([]);}}>Отмена</button>
        </div>
      </div>
    );
  };

  if (loading) return <div style={{color:'#fff',padding:32}}>Загрузка...</div>;
  if (error) return <div style={{color:'#fff',padding:32}}>Ошибка загрузки лотерей</div>;

  if (!userWallet) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#232C51'}}>
        <div style={{background:'#fff',borderRadius:20,padding:'32px 24px',maxWidth:360,width:'100%',boxShadow:'0 8px 32px #232C5140',textAlign:'center'}}>
          <div style={{fontWeight:700,fontSize:24,color:'#244',marginBottom:8}}>Привяжите TON-кошелёк</div>
          <div style={{fontSize:15,marginBottom:16,color:'#444'}}>Для получения выигрыша подключите свой TON Wallet через Telegram.<br/>Вы всегда сможете изменить его позже.</div>
          <button className="btn btn-primary" onClick={connectTonWallet} disabled={walletLoading}>
            {walletLoading ? 'Подключение...' : 'Подключить TON-кошелек через Telegram'}
          </button>
          {showWalletLink && (
            <button
              className="btn btn-outline-secondary ms-2"
              onClick={() => {
                window.open('https://t.me/wallet', '_blank');
              }}
            >
              Открыть TON Wallet
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#232C51',paddingBottom:40,backgroundImage:'radial-gradient(circle at 20% 20%, #7CD6FF22 0%, #232C5100 60%), radial-gradient(circle at 80% 10%, #F27AFF22 0%, #232C5100 60%)'}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 0 8px 0'}}>
        <span style={{marginRight:16,display:'flex',alignItems:'center'}}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="star-gradient-premium" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F27AFF"/>
                <stop offset="0.5" stopColor="#7CD6FF"/>
                <stop offset="1" stopColor="#7C5CFF"/>
              </linearGradient>
            </defs>
            <path d="M24 4c2.5 3.5 4.6 8.6 5.1 13.3H43c-2.3 2.1-6.6 5.2-10.5 8.4L36.2 40 24 31.3 11.8 40l3.7-14.4C11.6 22.5 7.3 19.4 5 17.3h13.9C19.4 12.6 21.5 7.5 24 4z" fill="url(#star-gradient-premium)"/>
            <g>
              <circle cx="10" cy="10" r="2" fill="#7CD6FF"/>
              <circle cx="38" cy="10" r="1.5" fill="#F27AFF"/>
              <circle cx="14" cy="38" r="1.2" fill="#7C5CFF"/>
              <circle cx="40" cy="36" r="1.7" fill="#7CD6FF"/>
              <circle cx="24" cy="44" r="1.3" fill="#F27AFF"/>
              <circle cx="8" cy="28" r="1" fill="#7C5CFF"/>
            </g>
          </svg>
        </span>
        <h1 style={{color:'#fff',fontWeight:700,letterSpacing:2,textShadow:'0 2px 12px #7C5CFF'}}>STARs Lottery</h1>
      </header>
      <div className="container py-4" style={{background:'rgba(255,255,255,0.97)',borderRadius:24,boxShadow:'0 8px 32px #0002',transition:'box-shadow 0.4s'}}>
        <h2 className="mb-4" style={{color:'#0d47a1'}}>Лотереи</h2>
        <div className="row">
          <div className="col-md-7">
            <h4>Активные</h4>
            <div className="row">
              {active.length === 0 && <div className="mb-3">Нет активных лотерей</div>}
              {active.map(lot => (
                <div className="col-12 col-sm-6 col-lg-4 mb-3" key={lot.id}>
                  <div className="card shadow-sm lottery-card" style={{border:'none',borderRadius:16,background:'linear-gradient(120deg,#232C51 60%,#3B4271 100%)',color:'#fff',transition:'box-shadow 0.2s',boxShadow:'0 2px 12px #7C5CFF33',padding:0}}>
                    <div style={{display:'flex',alignItems:'center',padding:'12px 16px',cursor:'pointer'}} onClick={()=>setSelected(selected===lot.id?null:lot.id)}>
                      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight:10}}>
                        <defs>
                          <linearGradient id="star-gradient-premium2" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#F27AFF"/>
                            <stop offset="0.5" stopColor="#7CD6FF"/>
                            <stop offset="1" stopColor="#7C5CFF"/>
                          </linearGradient>
                        </defs>
                        <path d="M24 4c2.5 3.5 4.6 8.6 5.1 13.3H43c-2.3 2.1-6.6 5.2-10.5 8.4L36.2 40 24 31.3 11.8 40l3.7-14.4C11.6 22.5 7.3 19.4 5 17.3h13.9C19.4 12.6 21.5 7.5 24 4z" fill="url(#star-gradient-premium2)"/>
                      </svg>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:18}}>{lot.name}</div>
                        <div style={{fontSize:13,opacity:0.8,marginTop:2}}>Цена: <b>{lot.ticket_price}</b> ⭐ | Приз: <b>{lot.ticket_price*lot.max_tickets}</b> ⭐</div>
                        <div style={{height:7,background:'#3B4271',borderRadius:6,overflow:'hidden',marginTop:6}}>
                          <div style={{width:`${100*lot.tickets_sold/lot.max_tickets}%`,height:'100%',background:'linear-gradient(90deg,#7CD6FF,#F27AFF)',transition:'width 0.6s'}}></div>
                        </div>
                      </div>
                      <button className="btn btn-sm" style={{background:'linear-gradient(90deg,#F27AFF,#7CD6FF)',color:'#232C51',fontWeight:700,marginLeft:8,display:'flex',alignItems:'center',gap:4,border:'none',borderRadius:8,boxShadow:'0 0 8px #7C5CFF80'}} onClick={e=>{e.stopPropagation();setSelected(lot.id);fetchTickets(lot.id);}}>
                        <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M24 4c2.5 3.5 4.6 8.6 5.1 13.3H43c-2.3 2.1-6.6 5.2-10.5 8.4L36.2 40 24 31.3 11.8 40l3.7-14.4C11.6 22.5 7.3 19.4 5 17.3h13.9C19.4 12.6 21.5 7.5 24 4z" fill="url(#star-gradient-premium2)"/>
                        </svg>
                        Купить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <h4 className="mt-4">Завершённые</h4>
        <div className="row">
          {finished.length === 0 && <div className="mb-3">Нет завершённых лотерей</div>}
          {finished.map(lot => (
            <div className="col-md-6 mb-3" key={lot.id}>
              <div className="card border-success shadow-lg lottery-card" style={{border:'none',borderRadius:18,background:'linear-gradient(120deg,#fffbe7 0%,#fff 100%)',transition:'transform 0.2s',boxShadow:'0 4px 24px #ffd60033',position:'relative',overflow:'hidden'}}>
                <div className="card-body" style={{position:'relative',zIndex:2}}>
                  <h5 className="card-title" style={{fontWeight:700,color:'#388e3c',textShadow:'0 1px 8px #ffd60040'}}>{lot.name}</h5>
                  <div className="mb-2">Цена: <b style={{color:'#ffd600'}}>{lot.ticket_price} Stars</b></div>
                  <div className="mb-2">Всего билетов: <b>{lot.max_tickets}</b></div>
                  <div className="mb-2">Продано: <b>{lot.tickets_sold}</b></div>
                  <div className="mb-2">Приз: <b style={{color:'#ffd600'}}>{lot.ticket_price*lot.max_tickets} Stars</b></div>
                  <div className="mt-2 text-success" style={{fontWeight:600}}>
                    Победитель: <b>{lot.winner_username || lot.winner_first_name || lot.winner_id}</b> (билет №{lot.winner_ticket_number})<br/>
                    {lot.random_link && (<span><a href={lot.random_link} target="_blank" rel="noopener noreferrer" style={{color:'#0d47a1',fontWeight:700}}>random.org</a></span>)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {buyStatus && <div className="alert alert-info mt-4">{buyStatus}</div>}
      </div>
    </div>
  );
}
