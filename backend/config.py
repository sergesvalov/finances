import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://finances_user:finances_password@localhost:5432/finances_db")
