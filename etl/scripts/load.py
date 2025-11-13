# etl/scripts/load.py
import json
import pandas as pd
from sqlalchemy import create_engine, text
from backend.app.database import engine
from pandas import isna

STAGING = "staging_bookings_raw"

import pandas as pd
import numpy as np
from datetime import datetime

def clean_json(obj):
    """ Recursively convert NaN, datetime, numpy types → JSON-safe values """
    
    # None stays None
    if obj is None:
        return None

    # NaN → None
    if isinstance(obj, float) and pd.isna(obj):
        return None

    # numpy types → Python native
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.ndarray, list)):
        return [clean_json(x) for x in obj]

    # datetime → string
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat()

    # dict → recursively clean
    if isinstance(obj, dict):
        return {str(k): clean_json(v) for k, v in obj.items()}

    # force key to string
    if isinstance(obj, (int, float, str, bool)):
        return obj

    # fallback → convert to string
    return str(obj)


def insert_staging(df, file_name, checksum):
    with engine.begin() as conn:
        for i, row in df.iterrows():

            raw_clean = clean_json(row["_raw"])
            canonical_clean = clean_json({
                k: v for k, v in row.items() if k not in ["_raw"]
            })

            conn.execute(text(f"""
                INSERT INTO {STAGING} (
                    file_name, file_checksum, raw_row_number,
                    raw_data, canonical_data, processing_status
                )
                VALUES (
                    :fn, :cs, :rn, :raw, :can, 'PENDING'
                )
            """), {
                "fn": file_name,
                "cs": checksum,
                "rn": i + 1,
                "raw": json.dumps(raw_clean),
                "can": json.dumps(canonical_clean),
            })




# -----------------------
# MERGE CONSENT → CUSTOMERS
# -----------------------
def merge_consent(df):
    merged = 0
    with engine.begin() as conn:
        for _, r in df.iterrows():
            raw_date = r.get("registration_date")

            if raw_date is None or isna(raw_date) or str(raw_date).lower() == "nan":
                registration_date = None
            elif isinstance(raw_date, (float, int)):
                # excel empty cells become floats — not valid
                registration_date = None
            else:
                registration_date = raw_date
            conn.execute(text("""
                INSERT INTO customers (full_name, email, contact_number, instagram_handle, acquisition_source, is_first_time, registration_date, consent,  package, created_at, last_updated)
                VALUES (:n, :e, :c, :ig, :aq, :ift, :rd, :c, :p, NOW(), NOW())
                ON CONFLICT (email) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    contact_number = EXCLUDED.contact_number,
                    instagram_handle = EXCLUDED.instagram_handle,
                    acquisition_source = EXCLUDED.acquisition_source,
                    is_first_time = EXCLUDED.is_first_time,
                    registration_date = EXCLUDED.registration_date,
                    consent = EXCLUDED.consent,
                    package = EXCLUDED.package
                    last_updated = NOW()
            """), {
                "n": r["full_name"],
                "e": r["email"],
                "c": r["contact_number"],
                "ig": r["instagram_handle"],
                "aq": r["acquisition_source"],
                "ift": r["is_first_time"],
                "rd": registration_date,
                "c": r["consent"],
                "p": r["package"]
            })
            merged += 1
    return merged


# -----------------------
# MERGE BOOKINGS → BOOKINGS TABLE
# -----------------------
def merge_bookings(df):
    merged = 0

    with engine.begin() as conn:
        for _, r in df.iterrows():

            # find customer
            row = conn.execute(text(
                "SELECT customer_id FROM customers WHERE email = :e"
            ), {"e": r["email"]}).fetchone()

            if not row:
                continue  # customer not in DB → skip

            customer_id = row[0]

            # get/create package
            pkg = conn.execute(text(
                "SELECT package_id FROM packages WHERE LOWER(name)=LOWER(:p)"
            ), {"p": r["package_name"]}).fetchone()

            if pkg:
                pkg_id = pkg[0]
            else:
                pkg_id = conn.execute(text("""
                    INSERT INTO packages (name, base_price)
                    VALUES (:n, :bp) RETURNING package_id
                """), {
                    "n": r["package_name"],
                    "bp": r["base_price"]
                }).fetchone()[0]

            # insert booking
            conn.execute(text("""
                INSERT INTO bookings (customer_id, package_id,
                    booking_date, session_date, base_price,
                    gcash_payment, cash_payment, session_status)
                VALUES (
                    :cid, :pid, NOW(), NOW(),
                    :bp, :gcash, :cash, 'BOOKED'
                )
            """), {
                "cid": customer_id,
                "pid": pkg_id,
                "bp": r["base_price"],
                "gcash": r["gcash_payment"],
                "cash": r["cash_payment"],
            })

            merged += 1

    return merged
