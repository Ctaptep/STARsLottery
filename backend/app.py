# FastAPI entrypoint for Telegram Mini App "Лотерея"

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
import os, hashlib, hmac
from dotenv import load_dotenv
from db import SessionLocal, init_db, Lottery, Ticket, User, Setting
from sqlalchemy.orm import Session
from fastapi import Depends

load_dotenv()

from fastapi import Body

app = FastAPI()

# Configure CORS (allow any origin, no credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# --- Startup hook to fill missing dates ---
@app.on_event("startup")
def _ensure_dates():
    db = SessionLocal()
    try:
        # created_at null -> now
        db.query(Lottery).filter(Lottery.created_at == None).update({Lottery.created_at: func.now()}, synchronize_session=False)
        # finished_at for finished lotteries
        db.query(Lottery).filter(Lottery.winner_id != None, Lottery.finished_at == None).update({Lottery.finished_at: func.now()}, synchronize_session=False)
        db.commit()
    finally:
        db.close()

# ---- Simple in-memory cache for TON/star rate ----
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "changeme")

_rate_cache = {
    "value": None,
    "ts": 0
}
RATE_CACHE_SECONDS = 300

from fastapi.middleware.cors import CORSMiddleware


@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(lambda: SessionLocal())):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        user = User(user_id=user_id)
        db.add(user)
        db.commit()
        db.refresh(user)
    return {
        "user_id": user.user_id,
        "ton_wallet_address": user.ton_wallet_address,
    }

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # можно ограничить до ["http://localhost:5173"]
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

class AuthData(BaseModel):
    id: int
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    auth_date: int
    hash: str


@app.get("/ping")
async def ping():
    return {"message": "pong"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class LotteryOut(BaseModel):
    id: int
    name: str
    ticket_price: int
    max_tickets: int
    tickets_sold: int
    participants: int
    winner_id: int | None = None
    winner_username: str | None = None
    winner_first_name: str | None = None
    winner_last_name: str | None = None
    winner_ticket_number: int | None = None
    random_link: str | None = None
    code: str | None = None
    created_at: datetime | None = None
    finished_at: datetime | None = None
    class Config:
        orm_mode = True

@app.get("/lotteries", response_model=list[LotteryOut])
def get_lotteries(db: Session = Depends(get_db)):
    lts = db.query(Lottery).all()
    # Если нет ни одной лотереи, создать дефолтную
    # Создать дефолтную лотерею, если её совсем нет или все предыдущие уже завершены
    active_exists = any(l.winner_id is None for l in lts)
    import re, uuid
    def _gen_code():
        return uuid.uuid4().hex[:8].upper()

        # determine next sequential number for auto lottery naming
    next_num = 1
    pattern = re.compile(r"Лотерея #(?P<num>\d+)")
    for lt in lts:
        m = pattern.match(lt.name)
        if m:
            try:
                n=int(m.group('num'))
                if n>=next_num:
                    next_num=n+1
            except:
                pass

    if not lts or not active_exists:
        obj = Lottery(
            name=f"Лотерея #{next_num}",
            ticket_price=1,
            max_tickets=100,
            tickets_sold=0,
            created_at=datetime.utcnow()
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        if not lts:
            lts = [obj]
        else:
            lts.append(obj)
    # separate finished and active
    finished = [l for l in lts if l.winner_id]
    active = [l for l in lts if not l.winner_id]
    finished.sort(key=lambda x: x.finished_at or x.id, reverse=True)
    ordered = active + finished

    result = []
    for l in ordered:
        winner_ticket = None
        if l.winner_id:
            winner_ticket = db.query(Ticket).filter_by(lottery_id=l.id, user_id=l.winner_id, ticket_number=l.winner_ticket_number).first()
        result.append({
            "id": l.id,
            "name": l.name,
            "ticket_price": l.ticket_price,
            "max_tickets": l.max_tickets,
            "tickets_sold": l.tickets_sold,
            "participants": db.query(func.count(func.distinct(Ticket.user_id))).filter(Ticket.lottery_id==l.id).scalar(),
            "winner_id": l.winner_id,
            "winner_username": winner_ticket.username if winner_ticket else None,
            "winner_first_name": winner_ticket.first_name if winner_ticket else None,
            "winner_last_name": winner_ticket.last_name if winner_ticket else None,
            "winner_ticket_number": l.winner_ticket_number,
            "random_link": l.random_link,
            "code": l.code,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "finished_at": l.finished_at.isoformat() if l.finished_at else None
        })
    return result

class LotteryCreate(BaseModel):
    name: str
    ticket_price: int
    max_tickets: int

@app.post("/lotteries/add")
def add_lottery(lottery: LotteryCreate, db: Session = Depends(get_db)):
    obj = Lottery(
        name=lottery.name,
        ticket_price=lottery.ticket_price,
        max_tickets=lottery.max_tickets,
        tickets_sold=0
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return {"ok": True, "id": obj.id}

class BuyTicketRequest(BaseModel):
    user_id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    ticket_numbers: list[int] = []

class WalletUpdateRequest(BaseModel):
    ton_wallet_address: str


# -------------------- Utility endpoints --------------------

def _get_star_usd(db: Session):
    rec = db.query(Setting).filter_by(key="STAR_USD_PRICE").first()
    if rec:
        try:
            return float(rec.value)
        except ValueError:
            pass
    return float(os.getenv("STAR_USD_PRICE", "0.0223"))

@app.get("/admin/star_price")
def admin_get_star_price(token: str, db: Session = Depends(get_db)):
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")
    return {"star_usd_price": _get_star_usd(db)}

class StarPriceUpdate(BaseModel):
    price: float

@app.post("/admin/star_price")
def admin_set_star_price(token: str, data: StarPriceUpdate, db: Session = Depends(get_db)):
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")
    rec = db.query(Setting).filter_by(key="STAR_USD_PRICE").first()
    if not rec:
        rec = Setting(key="STAR_USD_PRICE", value=str(data.price))
        db.add(rec)
    else:
        rec.value = str(data.price)
    db.commit()
    # clear cache
    _rate_cache.update({"value": None, "ts": 0})
    return {"ok": True, "star_usd_price": data.price}


@app.get("/rates/ton_star")
def get_ton_star_rate(db: Session = Depends(get_db)):
    """Return current conversion: how many ⭐ in 1 TON."""
    import time, requests
    now = time.time()
    if _rate_cache["value"] and now - _rate_cache["ts"] < RATE_CACHE_SECONDS:
        return {"ton_to_star": _rate_cache["value"], "cached": True}
    try:
        # Fallback constant if API fails
        ton_to_star = 25.0
        resp = requests.get("https://api.coingecko.com/api/v3/simple/price", params={"ids":"the-open-network","vs_currencies":"usd"}, timeout=5)
        data = resp.json()
        ton_usd = data.get("the-open-network", {}).get("usd")
        # Suppose 1 STAR = 0.04 USD (=> 1 TON ≈ 25⭐ when TON≈1 USD)
        star_usd = _get_star_usd(db)
        if ton_usd:
            ton_to_star = round(ton_usd / star_usd, 2)
    except Exception as ex:
        print("Rate fetch error:", ex)
        ton_to_star = 25.0
    _rate_cache.update({"value": ton_to_star, "ts": now})
    return {"ton_to_star": ton_to_star, "cached": False}


# ---- Wallet balance endpoint ----
@app.get("/wallet_balance/{address}")
def get_wallet_balance(address: str):
    """Return wallet balance in TON (approx). Uses tonapi.io."""
    import requests, math
    try:
        resp = requests.get(f"https://tonapi.io/v2/accounts/{address}")
        data = resp.json()
        balance_nano = int(data.get("balance", 0))
        balance_ton = round(balance_nano / 1e9, 3)
        return {"address": address, "balance_ton": balance_ton}
    except Exception as ex:
        print("wallet balance error", ex)
        return {"address": address, "balance_ton": None}


@app.get("/users/{user_id}/stats")
def user_stats(user_id: int, db: Session = Depends(get_db)):
    """Return wins, tickets bought, active lotteries count for user."""
    wins = db.query(func.count(Lottery.id)).filter(Lottery.winner_id == user_id).scalar() or 0
    tickets = db.query(func.count(Ticket.id)).filter(Ticket.user_id == user_id).scalar() or 0
    active = db.query(func.count(Lottery.id)).join(Ticket, Ticket.lottery_id == Lottery.id).filter(Ticket.user_id == user_id, Lottery.winner_id == None).scalar() or 0
    return {"wins": wins, "tickets": tickets, "active_lotteries": active}

@app.get("/users/{user_id}/balance")
def user_balance(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found")
    # stars_balance could be a column later; return 0 for now
    balance = getattr(user, "stars_balance", 0) or 0
    return {"stars_balance": balance}

from datetime import datetime

# -------------------- Lottery admin endpoints --------------------

class FinishLotteryReq(BaseModel):
    winner_id: int
    winner_ticket_number: int

@app.post("/lotteries/{lottery_id}/finish")
def finish_lottery(lottery_id: int, data: FinishLotteryReq, db: Session = Depends(get_db)):
    """Manually finish a lottery, set winner and finish timestamp."""
    lot = db.query(Lottery).filter(Lottery.id == lottery_id).first()
    if not lot:
        raise HTTPException(404, detail="Lottery not found")
    if lot.winner_id:
        raise HTTPException(400, detail="Already finished")
    lot.winner_id = data.winner_id
    lot.winner_ticket_number = data.winner_ticket_number
    lot.finished_at = datetime.utcnow()
    db.commit()
    return {"ok": True}

# -------------------- Existing endpoints --------------------

@app.post("/lotteries/{lottery_id}/buy")
def buy_ticket(lottery_id: int, req: BuyTicketRequest, db: Session = Depends(get_db)):
    lottery = db.query(Lottery).filter(Lottery.id == lottery_id).first()
    if not lottery:
        raise HTTPException(404, detail="Lottery not found")
    # Ensure user exists (create lazily)
    user = db.query(User).filter(User.user_id == req.user_id).first()
    if not user:
        user = User(
            user_id=req.user_id,
            username=req.username,
            first_name=req.first_name,
            last_name=req.last_name
        )
        db.add(user)
        db.commit()
    
    if not req.ticket_numbers or not isinstance(req.ticket_numbers, list):
        raise HTTPException(400, detail="No tickets selected")
    if len(req.ticket_numbers) + lottery.tickets_sold > lottery.max_tickets:
        raise HTTPException(400, detail="Not enough tickets left")

    # Создать или обновить пользователя
    user = db.query(User).filter(User.user_id == req.user_id).first()
    if not user:
        user = User(user_id=req.user_id, username=req.username, first_name=req.first_name, last_name=req.last_name)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Обновить данные пользователя при необходимости
        updated = False
        if req.username and user.username != req.username:
            user.username = req.username
            updated = True
        if req.first_name and user.first_name != req.first_name:
            user.first_name = req.first_name
            updated = True
        if req.last_name and user.last_name != req.last_name:
            user.last_name = req.last_name
            updated = True
        if updated:
            db.commit()

    # Проверка, что каждый выбранный номер свободен
    for num in req.ticket_numbers:
        exists = db.query(Ticket).filter_by(lottery_id=lottery_id, ticket_number=num).first()
        if exists:
            raise HTTPException(400, detail=f"Ticket {num} already sold")
        t = Ticket(
            lottery_id=lottery_id,
            user_id=req.user_id,
            username=req.username,
            first_name=req.first_name,
            last_name=req.last_name,
            ticket_number=num
        )
        db.add(t)
        lottery.tickets_sold += 1
    db.commit()

    # check completion
    if lottery.tickets_sold >= lottery.max_tickets and lottery.winner_id is None:
        choose_winner(lottery_id, db)
        db.commit()

    return {"ok": True, "tickets": req.ticket_numbers}



import requests, json, uuid

RANDOM_API_KEY=os.getenv("RANDOM_API_KEY")

def choose_winner(lottery_id: int, db: Session, force: bool=False):
    lottery = db.query(Lottery).filter(Lottery.id==lottery_id).first()
    if not lottery:
        raise HTTPException(404, detail="Lottery not found")
    # Запретить любой повторный розыгрыш, даже с force
    if lottery.winner_id is not None:
        raise HTTPException(400, detail="Winner already chosen")
    if not force and lottery.tickets_sold < lottery.max_tickets:
        raise HTTPException(400, detail="Not enough tickets sold")

    # Try random.org; if it fails or key not set, fallback to Python random()
    req_id = str(uuid.uuid4())
    random_number = None
    verify_url = None
    use_random_org = bool(RANDOM_API_KEY)
    try:
        if not use_random_org:
            raise Exception("RANDOM_API_KEY not set")
        payload = {
            "jsonrpc":"2.0",
            "method":"generateSignedIntegers",
            "params":{
                "apiKey": RANDOM_API_KEY,
                "n":1,
                "min":1,
                "max": lottery.tickets_sold,
                "replacement":False
            },
            "id": req_id
        }
        resp = requests.post("https://api.random.org/json-rpc/4/invoke", json=payload, timeout=10)
        data=resp.json()
        if "result" not in data or "random" not in data["result"]:
            raise Exception(f"random.org API error: {data}")
        random_obj=data["result"]["random"]
        random_number=random_obj["data"][0]
        # build verification link (https://api.random.org/verify?random=...&signature=...)
        import urllib.parse, json as _json
        random_json=_json.dumps(random_obj,separators=(',',':'))
        signature = data["result"]["signature"]
        verify_url="https://api.random.org/sign?random="+urllib.parse.quote(random_json)+"&signature="+urllib.parse.quote(signature)+"&format=html"
        print("DEBUG random_json:", random_json)
        print("DEBUG signature:", signature)
        print("DEBUG verify_url:", verify_url)
        # Генерация короткой ссылки через is.gd
        short_url = verify_url
        try:
            resp_short = requests.get(f'https://is.gd/create.php?format=simple&url={urllib.parse.quote(verify_url)}', timeout=5)
            if resp_short.status_code == 200 and resp_short.text.startswith('http'):
                short_url = resp_short.text.strip()
                print('DEBUG short_url:', short_url)
        except Exception as ex:
            print('Shortlink error:', ex)
        verify_url = short_url
    except Exception as e:
        # Fallback to python's random if random.org unavailable
        import random as _rnd
        random_number = _rnd.randint(1, lottery.tickets_sold)
        verify_url = None
        print("Fallback random():", random_number, "reason:", e)

    winner_ticket=db.query(Ticket).filter_by(lottery_id=lottery_id, ticket_number=random_number).first()
    if not winner_ticket:
        raise HTTPException(500, detail="Winner ticket not found")

    lottery.winner_id=winner_ticket.user_id
    lottery.winner_ticket_number=random_number
    lottery.random_link=verify_url
    db.add(lottery)
    db.commit()

    # Telegram notifications to ALL users who bought at least one ticket in this lottery
    BOT_TOKEN = os.getenv("BOT_TOKEN")
    ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")
    if BOT_TOKEN:
        def tg_send(chat, text):
            try:
                requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage", json={"chat_id": chat, "text": text, "parse_mode": "HTML"})
            except Exception as ex:
                print(f"Telegram send error: {ex}")
        # Получаем всех уникальных пользователей
        users = db.query(Ticket.user_id, Ticket.username, Ticket.first_name, Ticket.last_name).filter(Ticket.lottery_id==lottery_id).distinct().all()
        # Notify admin if configured
        if ADMIN_CHAT_ID and int(ADMIN_CHAT_ID) != winner_ticket.user_id:
            try:
                admin_msg = (f"Лотерея '{lottery.name}' завершена. Победитель: "
                             f"{winner_ticket.username or winner_ticket.first_name or winner_ticket.user_id} "
                             f"(ID {winner_ticket.user_id}) с билетом №{random_number}." +
                             (f"\nСсылка на проверку: {lottery.random_link}" if lottery.random_link else ""))
                tg_send(ADMIN_CHAT_ID, admin_msg)
            except Exception as ex:
                print('Admin notify error:', ex)

        for u in users:
            winner_name = winner_ticket.username or winner_ticket.first_name or str(winner_ticket.user_id)
            verify_html = f'<a href="{lottery.random_link}">Проверка random.org</a>'
            if u.user_id == winner_ticket.user_id:
                msg = f"🎉 Поздравляем! Вы выиграли лотерею '{lottery.name}' с билетом №{random_number}.\n{verify_html}"
            else:
                msg = f"Лотерея '{lottery.name}' завершена! Победитель: {winner_name}, билет №{random_number}.\n{verify_html}"
            tg_send(u.user_id, msg)
    return winner_ticket.user_id, random_number

class LotteryResult(BaseModel):
    lottery_id: int
    winner_id: int | None = None
    winner_username: str | None = None
    winner_first_name: str | None = None
    winner_last_name: str | None = None
    winner_ticket_number: int | None = None
    random_link: str | None = None

    class Config:
        orm_mode = True

@app.patch("/lotteries/{lottery_id}")
def update_lottery(lottery_id: int, payload: LotteryCreate, db: Session = Depends(get_db)):
    lottery = db.query(Lottery).filter(Lottery.id == lottery_id).first()
    if not lottery:
        raise HTTPException(404, detail="Lottery not found")
    if payload.max_tickets < lottery.tickets_sold:
        raise HTTPException(400, detail="max_tickets cannot be less than tickets_sold")
    lottery.name = payload.name
    lottery.ticket_price = payload.ticket_price
    lottery.max_tickets = payload.max_tickets
    db.commit()
    return {"ok": True}

@app.delete("/lotteries/{lottery_id}")
def delete_lottery(lottery_id: int, db: Session = Depends(get_db)):
    lot = db.query(Lottery).filter(Lottery.id == lottery_id).first()
    if not lot:
        raise HTTPException(404, detail="Lottery not found")
    db.query(Ticket).filter(Ticket.lottery_id == lottery_id).delete()
    db.delete(lot)
    db.commit()
    return {"ok": True}

class TicketOut(BaseModel):
    id: int
    lottery_id: int
    user_id: int
    ticket_number: int
    class Config:
        orm_mode = True

@app.get("/tickets", response_model=list[TicketOut])
def list_tickets(lottery_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Ticket)
    if lottery_id is not None:
        q = q.filter(Ticket.lottery_id == lottery_id)
    return q.all()

# New helper route for frontend compatibility
@app.get("/lotteries/{lottery_id}/tickets", response_model=list[TicketOut])
def list_tickets_by_lottery(lottery_id: int, db: Session = Depends(get_db)):
    """Return all tickets for a specific lottery (alias of /tickets?lottery_id=)."""
    return db.query(Ticket).filter(Ticket.lottery_id == lottery_id).all()

@app.post("/lotteries/{lottery_id}/draw")
def manual_draw(lottery_id: int, db: Session = Depends(get_db)):
    res = choose_winner(lottery_id, db, force=True)
    db.commit()
    if res:
        uid, num = res
        return {"ok": True, "winner_id": uid, "ticket_number": num}
    return {"ok": False, "detail": "Unable to draw"}

class StatsOut(BaseModel):
    tickets_sold: int
    revenue: int

@app.get("/lotteries/{lottery_id}/stats", response_model=StatsOut)
def lottery_stats(lottery_id: int, db: Session = Depends(get_db)):
    lot = db.query(Lottery).filter(Lottery.id == lottery_id).first()
    if not lot:
        raise HTTPException(404, detail="Lottery not found")
    return StatsOut(tickets_sold=lot.tickets_sold, revenue=lot.tickets_sold*lot.ticket_price)

from fastapi.responses import StreamingResponse
import csv, io

@app.get("/export/lotteries")
def export_lotteries(db: Session = Depends(get_db)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id","name","ticket_price","max_tickets","tickets_sold","winner_id","winner_ticket_number"])
    for l in db.query(Lottery).all():
        writer.writerow([l.id,l.name,l.ticket_price,l.max_tickets,l.tickets_sold,l.winner_id,l.winner_ticket_number])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition":"attachment; filename=lotteries.csv"})

@app.get("/export/tickets")
def export_tickets(db: Session = Depends(get_db)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id","lottery_id","user_id","ticket_number"])
    for t in db.query(Ticket).all():
        writer.writerow([t.id,t.lottery_id,t.user_id,t.ticket_number])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition":"attachment; filename=tickets.csv"})

@app.get("/lotteries/{lottery_id}/result", response_model=LotteryResult)
def get_lottery_result(lottery_id: int, db: Session = Depends(get_db)):
    lottery = db.query(Lottery).filter(Lottery.id == lottery_id).first()
    if not lottery:
        raise HTTPException(404, detail="Lottery not found")
    winner_ticket = None
    if lottery.winner_id:
        winner_ticket = db.query(Ticket).filter_by(lottery_id=lottery.id, user_id=lottery.winner_id, ticket_number=lottery.winner_ticket_number).first()
    return LotteryResult(
        lottery_id=lottery.id,
        winner_id=lottery.winner_id,
        winner_username=winner_ticket.username if winner_ticket else None,
        winner_first_name=winner_ticket.first_name if winner_ticket else None,
        winner_last_name=winner_ticket.last_name if winner_ticket else None,
        winner_ticket_number=lottery.winner_ticket_number,
        random_link=lottery.random_link
    )


def _verify_hash(data: dict, bot_token: str) -> bool:
    recv_hash = data.pop("hash")
    data_check_string = "\n".join([f"{k}={v}" for k, v in sorted(data.items())])
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_hash, recv_hash)


@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found")
    return {
        "user_id": user.user_id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "ton_wallet_address": user.ton_wallet_address
    }

@app.post("/users/{user_id}/wallet")
def update_wallet(user_id: int, req: WalletUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found")
    user.ton_wallet_address = req.ton_wallet_address
    db.commit()
    return {"ok": True, "ton_wallet_address": user.ton_wallet_address}

@app.post("/auth/verify")
async def auth_verify(payload: AuthData):
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token:
        raise HTTPException(500, detail="BOT_TOKEN not set")

    data = payload.dict()
    if _verify_hash(data.copy(), bot_token):
        return {"ok": True, "user_id": payload.id}
    return {"ok": False, "reason": "invalid hash"}

