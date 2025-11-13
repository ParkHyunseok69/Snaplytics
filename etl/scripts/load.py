# load.py
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
import pandas as pd
from dotenv import load_dotenv
from pathlib import Path
from sqlalchemy.orm import sessionmaker
import re
import json

# ✅ Always load backend/.env
env_path = Path(__file__).resolve().parents[2] / "backend" / ".env"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in env")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

STAGING_TABLE = "staging_bookings_raw"

def insert_staging(df: pd.DataFrame, file_name: str, file_checksum: str, run_id=None):

    with engine.begin() as conn:
        for i, r in df.iterrows():

            # ✅ FIX: normalize dict keys AND values
            raw = {str(k): (None if isinstance(v, float) and pd.isna(v) else v) for k, v in r["_raw"].items()}
            canonical = {str(k): (None if pd.isna(v) else v) for k, v in r.items() if k not in ["_raw"]}

            conn.execute(
                text(f"""
                INSERT INTO {STAGING_TABLE}
                   (file_name, file_checksum, raw_row_number, raw_data, canonical_data, processing_status, run_id)
                VALUES
                   (:fn, :cs, :rn, :raw, :can, :st, :run)
                RETURNING id
                """),
                {
                    "fn": file_name,
                    "cs": file_checksum,
                    "rn": i + 1,
                    "raw": json.dumps(raw, default=str),          # ✅ works now
                    "can": json.dumps(canonical, default=str),    # ✅ works now
                    "st": "PENDING",
                    "run": run_id,
                }
            )



def _get_package_id(package_name: str, conn):
    if not package_name:
        return None
    res = conn.execute(text("SELECT package_id FROM packages WHERE lower(name)=lower(:n)"), {"n": package_name}).fetchone()
    if res:
        return res[0]
    # create package (PACKAGES = B -> auto-create)
    r = conn.execute(text("INSERT INTO packages (name, base_price) VALUES (:n, null) RETURNING package_id"), {"n": package_name}).fetchone()
    return r[0]

def _get_addon_id(addon_name: str, conn):
    if not addon_name: return None
    res = conn.execute(text("SELECT addon_id FROM addons WHERE lower(name)=lower(:n)"), {"n": addon_name}).fetchone()
    if res:
        return res[0]
    r = conn.execute(text("INSERT INTO addons (name, price) VALUES (:n, null) RETURNING addon_id"), {"n": addon_name}).fetchone()
    return r[0]

def _resolve_customer_id(email: str, conn):
    if not email: return None
    res = conn.execute(text("SELECT customer_id FROM customers WHERE lower(email)=lower(:e)"), {"e": email}).fetchone()
    return res[0] if res else None

def merge_rows(df: pd.DataFrame, file_name: str):
    errors = []
    merged = 0
    with engine.begin() as conn:
        for i, r in df.iterrows():
            email = r.get("email") if "email" in r else None
            package_name = r.get("package_name")
            session_date = r.get("session_date")
            base_price = r.get("base_price") or 0.0
            # attempt resolve customer
            customer_id = _resolve_customer_id(email, conn)
            if not customer_id:
                # update staging row to MISSING_CUSTOMER
                conn.execute(text(f"""
                    UPDATE {STAGING_TABLE}
                    SET processing_status='MISSING_CUSTOMER', error_messages = array_append(coalesce(error_messages, ARRAY[]::text[]), :err)
                    WHERE file_name=:fn AND raw_row_number=:rn
                """), {"err":"customer not found", "fn": file_name, "rn": i+1})
                errors.append((i+1, "customer not found"))
                continue

            package_id = _get_package_id(package_name, conn) if package_name else None

            # Upsert booking by business key (customer_id, package_id, session_date, base_price)
            res = conn.execute(text("""
                INSERT INTO bookings (external_booking_id, customer_id, package_id, booking_date, session_date, base_price, gcash_payment, cash_payment, session_status)
                VALUES (:ext, :cid, :pid, :bdate, :sdate, :bp, :gpay, :cpay, :status)
                ON CONFLICT (customer_id, package_id, session_date, base_price)
                DO UPDATE SET
                  booking_date = EXCLUDED.booking_date,
                  gcash_payment = EXCLUDED.gcash_payment,
                  cash_payment = EXCLUDED.cash_payment,
                  session_status = EXCLUDED.session_status,
                  last_updated = now()
                RETURNING booking_id
            """), {
                "ext": None,
                "cid": customer_id,
                "pid": package_id,
                "bdate": None,
                "sdate": session_date,
                "bp": base_price,
                "gpay": r.get("gcash_payment") or 0.0,
                "cpay": r.get("cash_payment") or 0.0,
                "status": r.get("session_status") or "BOOKED"
            }).fetchone()

            if not res:
                errors.append((i+1, "failed booking upsert"))
                conn.execute(text(f"UPDATE {STAGING_TABLE} SET processing_status='ERROR', error_messages = array_append(coalesce(error_messages, ARRAY[]::text[]), :err) WHERE file_name=:fn AND raw_row_number=:rn"),
                             {"err":"failed booking upsert","fn":file_name,"rn":i+1})
                continue

            booking_id = res[0]
            merged += 1

            # handle addon_raw (basic parse: comma-separated "AddonName: price" or names)
            addon_raw = r.get("addon_raw")
            if addon_raw and isinstance(addon_raw, str):
                parts = [p.strip() for p in re.split(r"[;/,|]+", addon_raw) if p.strip()]
                for p in parts:
                    # try separate qty or price e.g. "Additional 1 Edited Photo - Php 70"
                    name = p
                    price = None
                    m = re.search(r"php\s*([\d,\.]+)", p, flags=re.I)
                    if m:
                        price = float(m.group(1).replace(",",""))
                        name = re.sub(r"php\s*[\d,\.]+","", name, flags=re.I).strip(" -:")
                    addon_id = _get_addon_id(name, conn)
                    total_addon_cost = price or 0.0
                    # upsert booking_addons
                    conn.execute(text("""
                        INSERT INTO booking_addons (booking_id, addon_id, addon_quantity, addon_price, total_addon_cost)
                        VALUES (:bid, :aid, :qty, :ap, :total)
                        ON CONFLICT (booking_id, addon_id) DO UPDATE
                          SET addon_quantity = EXCLUDED.addon_quantity,
                              addon_price = EXCLUDED.addon_price,
                              total_addon_cost = EXCLUDED.total_addon_cost,
                              last_updated = now();
                    """), {"bid": booking_id, "aid": addon_id, "qty": 1, "ap": price or 0.0, "total": total_addon_cost})

            # mark staging row merged
            conn.execute(text(f"UPDATE {STAGING_TABLE} SET processing_status='MERGED' WHERE file_name=:fn AND raw_row_number=:rn"),
                         {"fn": file_name, "rn": i+1})
    return {"merged": merged, "errors": errors}
