from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os
from backend.app.models import *

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in environment (.env)")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"sslmode": "require"})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# ✅ Drop + recreate staging table on startup
def create_staging_table():
    with engine.begin() as conn:
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS staging_bookings_raw (
            id SERIAL PRIMARY KEY,
            file_name TEXT NOT NULL,
            file_checksum TEXT NOT NULL,
            raw_row_number INTEGER NOT NULL,
            raw_data JSONB,
            canonical_data JSONB,
            processing_status TEXT DEFAULT 'PENDING',
            error_messages TEXT[],
            run_id UUID DEFAULT gen_random_uuid(),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        """))

# ✅ Auto-execute on backend startup
create_staging_table()
from backend.app.models import *
Base.metadata.create_all(bind=engine)
