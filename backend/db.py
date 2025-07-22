from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Float, DateTime
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

SQLALCHEMY_DATABASE_URL = "sqlite:///./lottery.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    ton_wallet_address = Column(String, nullable=True)

    tickets = relationship("Ticket", back_populates="user")
    payments = relationship("PaymentLog", back_populates="user")


class Lottery(Base):
    __tablename__ = "lotteries"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    ticket_price = Column(Integer, nullable=False)
    max_tickets = Column(Integer, nullable=False)
    tickets_sold = Column(Integer, default=0)
    prize_ton = Column(Float, default=0)
    code = Column(String, nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
    winner_id = Column(Integer, nullable=True)
    winner_ticket_number = Column(Integer, nullable=True)
    random_link = Column(String, nullable=True)

    tickets = relationship("Ticket", back_populates="lottery")

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    lottery_id = Column(Integer, ForeignKey("lotteries.id"))
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    ticket_number = Column(Integer, nullable=False)
    lottery = relationship("Lottery", back_populates="tickets")
    user = relationship("User", back_populates="tickets")

def auto_migrate_tickets_table():
    # Автоматически добавляет новые поля, если их нет (SQLite)
    import sqlite3
    conn = sqlite3.connect("lottery.db")
    cur = conn.cursor()
    # Lotteries
    cur.execute("PRAGMA table_info(lotteries);")
    lot_cols = [row[1] for row in cur.fetchall()]
    for col_def in [("code", "TEXT"), ("created_at", "DATETIME"), ("finished_at", "DATETIME"), ("prize_ton", "FLOAT")]:
        if col_def[0] not in lot_cols:
            cur.execute(f"ALTER TABLE lotteries ADD COLUMN {col_def[0]} {col_def[1]};")

    # Tickets
    cur.execute("PRAGMA table_info(tickets);")
    cols = [row[1] for row in cur.fetchall()]
    for col in ["username", "first_name", "last_name"]:
        if col not in cols:
            cur.execute(f"ALTER TABLE tickets ADD COLUMN {col} TEXT;")
    # Users
    cur.execute("PRAGMA table_info(users);")
    user_cols = [row[1] for row in cur.fetchall()]
    if "ton_wallet_address" not in user_cols and len(user_cols) > 0:
        cur.execute("ALTER TABLE users ADD COLUMN ton_wallet_address TEXT;")
    # Payments
    cur.execute("PRAGMA table_info(payment_logs);")
    payment_cols = [row[1] for row in cur.fetchall()]
    if len(payment_cols) == 0:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS payment_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                lottery_id INTEGER,
                amount_ton FLOAT,
                status TEXT,
                transaction_hash TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(user_id)
            )
        """)
    conn.commit()
    conn.close()

class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)

    def __repr__(self):
        return f"<Setting {self.key}={self.value}>"

class PaymentLog(Base):
    __tablename__ = "payment_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    lottery_id = Column(Integer)
    amount_ton = Column(Float)
    status = Column(String)
    transaction_hash = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", back_populates="payments")

def init_db():
    Base.metadata.create_all(bind=engine)
    auto_migrate_tickets_table()
