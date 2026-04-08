"""
Telegram bot for receiving receipts.
Triggered by the word 'чек' (case-insensitive).
Opens a 10-minute window to receive photo(s) from the user.
All photos sent in one window form a single upload session.
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime

from sqlalchemy.orm import Session
from database import SessionLocal
from models import ReceiptUpload, Setting

logger = logging.getLogger(__name__)

RECEIPTS_INBOX = "/app/receipts/inbox"
SESSION_TIMEOUT = 600  # 10 minutes

# Active sessions: {chat_id: {"session_id": str, "count": int, "task": asyncio.Task}}
_active_sessions: dict = {}


def _get_token() -> str | None:
    """Read the bot token from the DB settings table."""
    db: Session = SessionLocal()
    try:
        row = db.query(Setting).filter(Setting.key == "telegram_bot_token").first()
        return row.value.strip() if row and row.value and row.value.strip() else None
    finally:
        db.close()


def _save_receipt(session_id: str, chat_id: str, filename: str, original_filename: str) -> None:
    db: Session = SessionLocal()
    try:
        rec = ReceiptUpload(
            session_id=session_id,
            filename=filename,
            uploaded_at=datetime.utcnow(),
            telegram_chat_id=str(chat_id),
            original_filename=original_filename,
        )
        db.add(rec)
        db.commit()
    finally:
        db.close()


async def _session_timeout(bot, chat_id: int, session_id: str) -> None:
    """Wait SESSION_TIMEOUT seconds then close the session and notify the user."""
    await asyncio.sleep(SESSION_TIMEOUT)
    session = _active_sessions.pop(chat_id, None)
    if session:
        count = session.get("count", 0)
        await bot.send_message(
            chat_id=chat_id,
            text=f"✅ Сессия завершена. Загружено чеков: {count}.",
        )


async def run_bot(token: str) -> None:
    """Start the Telegram bot (polling). Called once at FastAPI startup."""
    from telegram import Update
    from telegram.ext import (
        Application,
        MessageHandler,
        filters,
        ContextTypes,
    )

    async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        text = (update.message.text or "").strip().lower()
        chat_id = update.effective_chat.id

        if "чек" in text:
            # Cancel existing session if any
            existing = _active_sessions.get(chat_id)
            if existing and not existing["task"].done():
                existing["task"].cancel()

            session_id = uuid.uuid4().hex
            folder = os.path.join(RECEIPTS_INBOX, session_id)
            os.makedirs(folder, exist_ok=True)

            task = asyncio.create_task(
                _session_timeout(context.bot, chat_id, session_id)
            )
            _active_sessions[chat_id] = {"session_id": session_id, "count": 0, "task": task}

            await update.message.reply_text(
                "📸 Жду фото чеков в течение 10 минут. Отправляй!"
            )

    async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        chat_id = update.effective_chat.id
        session = _active_sessions.get(chat_id)

        if not session:
            # Not in an active receipt session — ignore silently
            return

        session_id = session["session_id"]
        folder = os.path.join(RECEIPTS_INBOX, session_id)
        os.makedirs(folder, exist_ok=True)

        # Download the largest available photo size
        photo = update.message.photo[-1]
        file = await context.bot.get_file(photo.file_id)

        ext = ".jpg"
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(folder, filename)
        await file.download_to_drive(dest)

        _save_receipt(
            session_id=session_id,
            chat_id=str(chat_id),
            filename=filename,
            original_filename=filename,
        )

        session["count"] += 1
        count = session["count"]
        await update.message.reply_text(f"✅ Чек {count} сохранён.")

    app = (
        Application.builder()
        .token(token)
        .build()
    )

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))

    logger.info("Telegram bot starting (polling)...")
    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=True)
    logger.info("Telegram bot is running.")
    # Keep running forever — FastAPI lifespan will shut it down
    try:
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        pass
    finally:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()
        logger.info("Telegram bot stopped.")


async def start_bot_task() -> asyncio.Task | None:
    """
    Read the token from DB and start the bot as a background asyncio task.
    Returns the Task or None if no token is configured.
    """
    os.makedirs(RECEIPTS_INBOX, exist_ok=True)
    token = _get_token()
    if not token:
        logger.warning("Telegram bot token not configured — bot will not start.")
        return None
    task = asyncio.create_task(run_bot(token))
    return task
