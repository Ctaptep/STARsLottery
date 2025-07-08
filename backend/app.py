# FastAPI entrypoint for Telegram Mini App "Лотерея"

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os, hashlib, hmac
from dotenv import load_dotenv
from db import SessionLocal, init_db, Lottery, Ticket, User
from sqlalchemy.orm import Session
from fastapi import Depends

load_dotenv()

from fastapi import Body

app = FastAPI()

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
    allow_credentials=True,
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
    winner_id: int | None = None
    winner_username: str | None = None
    winner_first_name: str | None = None
    winner_last_name: str | None = None
    winner_ticket_number: int | None = None
    random_link: str | None = None
    class Config:
        orm_mode = True

@app.get("/lotteries", response_model=list[LotteryOut])
def get_lotteries(db: Session = Depends(get_db)):
    lts = db.query(Lottery).all()
    # Если нет ни одной лотереи, создать дефолтную
    if not lts:
        obj = Lottery(
            name="Лотерея #1",
            ticket_price=1,
            max_tickets=100,
            tickets_sold=0
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        lts = [obj]
    result = []
    for l in lts:
        winner_ticket = None
        if l.winner_id:
            winner_ticket = db.query(Ticket).filter_by(lottery_id=l.id, user_id=l.winner_id, ticket_number=l.winner_ticket_number).first()
        result.append({
            "id": l.id,
            "name": l.name,
            "ticket_price": l.ticket_price,
            "max_tickets": l.max_tickets,
            "tickets_sold": l.tickets_sold,
            "winner_id": l.winner_id,
            "winner_username": winner_ticket.username if winner_ticket else None,
            "winner_first_name": winner_ticket.first_name if winner_ticket else None,
            "winner_last_name": winner_ticket.last_name if winner_ticket else None,
            "winner_ticket_number": l.winner_ticket_number,
            "random_link": l.random_link
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
    if BOT_TOKEN:
        def tg_send(chat, text):
            try:
                requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage", json={"chat_id": chat, "text": text, "parse_mode": "HTML"})
            except Exception as ex:
                print(f"Telegram send error: {ex}")
        # Получаем всех уникальных пользователей
        users = db.query(Ticket.user_id, Ticket.username, Ticket.first_name, Ticket.last_name).filter(Ticket.lottery_id==lottery_id).distinct().all()
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

