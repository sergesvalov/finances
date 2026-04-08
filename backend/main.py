import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import Base, engine
from routers import import_api, transactions, analytics, categories, tags, settings, recipients, receipt_uploads
import telegram_bot as tg_bot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create the database tables
Base.metadata.create_all(bind=engine)

RECEIPTS_DIR = "/app/receipts"
RECEIPTS_INBOX = "/app/receipts/inbox"
os.makedirs(RECEIPTS_DIR, exist_ok=True)
os.makedirs(RECEIPTS_INBOX, exist_ok=True)

_bot_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _bot_task
    _bot_task = await tg_bot.start_bot_task()
    yield
    if _bot_task and not _bot_task.done():
        _bot_task.cancel()
        try:
            await _bot_task
        except asyncio.CancelledError:
            pass
        logger.info("Bot task cancelled on shutdown.")


app = FastAPI(title="Finance Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_api.router)
app.include_router(transactions.router)
app.include_router(analytics.router)
app.include_router(categories.router)
app.include_router(tags.router)
app.include_router(settings.router)
app.include_router(recipients.router)
app.include_router(receipt_uploads.router)

# Serve uploaded receipts as static files
app.mount("/receipts", StaticFiles(directory=RECEIPTS_DIR), name="receipts")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
