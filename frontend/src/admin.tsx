import React, { useEffect, useState } from 'react';

function getApiUrl() {
  return import.meta.env.VITE_API_URL || 'http://localhost:8000';
}

type Lottery = {
  id: number;
  name: string;
  ticket_price: number;
  max_tickets: number;
  tickets_sold: number;
  winner_username?: string;
  winner_first_name?: string;
  winner_id?: number;
  winner_ticket_number?: number;
  random_link?: string;
};

const ADMIN_PASSWORD = 'admin123'; // Задайте свой пароль

export const AdminPanel: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState('');

  // Data hooks MUST be declared unconditionally
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const [selectedLot, setSelectedLot] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', ticket_price: '', max_tickets: '' });
  const [status, setStatus] = useState<string | null>(null);

  // Fetch lotteries only when logged in
  useEffect(() => {
    if (!loggedIn) return;
    setLoading(true);
    fetch(`${getApiUrl()}/lotteries`)
      .then(r => r.json())
      .then(setLotteries)
      .catch(() => setError('Ошибка загрузки лотерей'))
      .finally(() => setLoading(false));
    // Polling
    const poll = setInterval(() => {
      fetch(`${getApiUrl()}/lotteries`)
        .then(r => r.json())
        .then(setLotteries);
    }, 3000);
    return () => clearInterval(poll);
  }, [loggedIn, status]);

  const refresh = () => {
    setTickets(null);
    setOpened(null);
    setStatus(Date.now().toString());
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить лотерею?')) return;
    await fetch(`${getApiUrl()}/lotteries/${id}`, { method: 'DELETE' });
    refresh();
  };

  const handleDraw = async (id: number) => {
    await fetch(`${getApiUrl()}/lotteries/${id}/draw`, { method: 'POST' });
    refresh();
  };

  const handleStats = async (id: number) => {
    const res = await fetch(`${getApiUrl()}/lotteries/${id}/stats`);
    const data = await res.json();
    alert(`Продано: ${data.tickets_sold}\nВыручка: ${data.revenue}₽`);
  };

  const handleOpen = async (id: number) => {
    if (opened === id) { setOpened(null); return; }
    setOpened(id);
    setSelectedLot(id);
    // загрузка билетов и статистики
    const [ticketsRes, statsRes, resultRes] = await Promise.all([
      fetch(`${getApiUrl()}/tickets?lottery_id=${id}`),
      fetch(`${getApiUrl()}/lotteries/${id}/stats`),
      fetch(`${getApiUrl()}/lotteries/${id}/result`)
    ]);
    setTickets(await ticketsRes.json());
    const stats = await statsRes.json();
    const result = await resultRes.json();
    alert(`Статистика:\nПродано: ${stats.tickets_sold}\nВыручка: ${stats.revenue}₽` +
      (result.winner_id ? `\n\nПобедитель: ${result.winner_username || result.winner_first_name || result.winner_id}\nБилет №${result.winner_ticket_number}\nСсылка: ${result.random_link}` : ''));
  };

  if (!loggedIn) {
    return (
      <form onSubmit={e => { e.preventDefault(); if (password === ADMIN_PASSWORD) setLoggedIn(true); else alert('Неверный пароль'); }} style={{marginTop: 80, textAlign: 'center'}}>
        <h2>Вход в админ-панель</h2>
        <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit" style={{marginLeft: 8}}>Войти</button>
      </form>
    );
  }


  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      const res = await fetch(`${getApiUrl()}/lotteries/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          ticket_price: Number(form.ticket_price),
          max_tickets: Number(form.max_tickets)
        })
      });
      const data = await res.json();
      if (data.ok) setStatus('Лотерея создана!');
      else setStatus(data.detail || 'Ошибка создания');
      setForm({ name: '', ticket_price: '', max_tickets: '' });
    } catch (e) {
      setStatus('Ошибка соединения');
    }
  };

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h2>Админ-панель: Лотереи</h2>
      <form onSubmit={handleCreate} style={{marginBottom: 20}}>
        <input required placeholder="Название" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
        <input required placeholder="Цена" type="number" value={form.ticket_price} onChange={e => setForm(f => ({...f, ticket_price: e.target.value}))} />
        <input required placeholder="Макс. билетов" type="number" value={form.max_tickets} onChange={e => setForm(f => ({...f, max_tickets: e.target.value}))} />
        <button type="submit">Создать лотерею</button>
      </form>
      <table className="table table-bordered table-sm">
        <thead className="table-light"><tr><th>ID</th><th>Название</th><th>Цена</th><th>Всего</th><th>Продано</th><th>Победитель</th><th>Проверка random.org</th><th>Действия</th></tr></thead>
        <tbody>
        {lotteries.map(lot => (
          <tr key={lot.id} className={opened===lot.id?'table-info':''}>
            <td>{lot.id}</td><td>{lot.name}</td><td>{lot.ticket_price}₽</td><td>{lot.max_tickets}</td><td>{lot.tickets_sold}</td>
            <td>{lot.winner_username || lot.winner_first_name || lot.winner_id || '-'}</td>
            <td>{lot.random_link ? <a href={lot.random_link} target="_blank" rel="noopener noreferrer">Проверка</a> : '-'}</td>
            <td>
            <button className="btn btn-sm btn-primary me-1" onClick={() => handleOpen(lot.id)}>{opened===lot.id?'Скрыть':'Открыть'}</button>{' '}
            <button className="btn btn-sm btn-success me-1" onClick={() => handleDraw(lot.id)}>Розыгрыш</button>{' '}
            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(lot.id)}>Удалить</button>
          </td></tr>
        ))}
      </tbody>
      </table>

      {opened && tickets && (
        <div style={{marginTop:20}}>
          <h3>Билеты лотереи #{selectedLot}</h3>
          <table border={1} cellPadding={4}>
            <thead><tr><th>ID</th><th>User</th><th>№</th></tr></thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} style={lotteries.find(l=>l.id===selectedLot)?.winner_ticket_number===t.ticket_number?{background:'#d4edda',fontWeight:'bold'}:{}}>
                  <td>{t.id}</td><td>{t.user_id}</td><td>{t.ticket_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {status && <div style={{marginTop: 16}}>{status}</div>}
    </div>
  );
