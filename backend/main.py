import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import Base, engine
from routers import import_api, transactions, analytics, categories, tags, settings, recipients

# Create the database tables
Base.metadata.create_all(bind=engine) # We will rely on Alembic ideally, but this is a fallback.

RECEIPTS_DIR = "/app/receipts"
os.makedirs(RECEIPTS_DIR, exist_ok=True)

app = FastAPI(title="Finance Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
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

# Serve uploaded receipts as static files
app.mount("/receipts", StaticFiles(directory=RECEIPTS_DIR), name="receipts")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
