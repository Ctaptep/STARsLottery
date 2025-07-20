"""Fetch current price of Telegram Stars via @PremiumBot and update STAR_USD_PRICE env.

This script connects to Telegram via Telethon using a bot token, fetches the last
messages from @PremiumBot that contain package prices (e.g. "100 ⭐ = $1.99"),
extracts the price for the 100-star pack, derives USD per star and writes it to
an environment file that is loaded by the backend.

Schedule to run daily via cron or any scheduler.
Required env variables:
    API_ID, API_HASH – Telegram API credentials (https://my.telegram.org)
    BOT_TOKEN      – Token of your bot (BotFather)
    ENV_PATH       – Path to .env file to update (default: "../.env")
"""
from __future__ import annotations
import asyncio
import os
import re
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError

API_ID = int(os.getenv("API_ID", "0"))
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
PREMIUM_BOT = "@PremiumBot"
ENV_PATH = Path(os.getenv("ENV_PATH", Path(__file__).resolve().parent.parent / ".env"))
STAR_PACK_RE = re.compile(r"(?P<count>\d+)\s*⭐\s*=\s*\$?(?P<price>[0-9,.]+)")

assert API_ID and API_HASH and BOT_TOKEN, "API_ID, API_HASH, BOT_TOKEN are required"


def _update_env(new_value: Decimal) -> None:
    """Write STAR_USD_PRICE to .env, create if absent."""
    lines = []
    updated = False
    if ENV_PATH.exists():
        with ENV_PATH.open("r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("STAR_USD_PRICE="):
                    lines.append(f"STAR_USD_PRICE={new_value}\n")
                    updated = True
                else:
                    lines.append(line)
    if not updated:
        lines.append(f"STAR_USD_PRICE={new_value}\n")
    with ENV_PATH.open("w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"ENV updated: STAR_USD_PRICE={new_value}")


async def main():
    client = TelegramClient("stars-price", API_ID, API_HASH)
    await client.start(bot_token=BOT_TOKEN)
    try:
        msgs = await client.get_messages(PREMIUM_BOT, limit=30)
    except SessionPasswordNeededError:
        print("Two-factor auth enabled for this bot account; cannot continue.")
        return

    price_per_star: Decimal | None = None
    for m in msgs:
        match = STAR_PACK_RE.search(m.message or "")
        if match and match.group("count") == "100":
            count = Decimal(match.group("count"))
            price = Decimal(match.group("price").replace(",", ""))
            price_per_star = (price / count).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            break

    if price_per_star is None:
        print("Failed to parse price from @PremiumBot messages")
        return

    _update_env(price_per_star)

if __name__ == "__main__":
    asyncio.run(main())
