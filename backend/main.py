from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from routers import import_api, transactions, analytics

# Create the database tables
# Base.metadata.create_all(bind=engine) # We will rely on Alembic ideally, but this is a fallback.

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

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
