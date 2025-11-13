# etl/scripts/transform.py
import pandas as pd
import numpy as np
import re

def detect_format(df):
    # Format A: header row (strings, not NaN)
    headers = df.iloc[0].values
    string_count = sum(isinstance(x, str) for x in headers)

    # If at least 5 strings → a consent header
    if string_count >= 5:
        return "consent"
    return "blocks"


# -----------------------
# FORMAT A: CONSENT FORM
# -----------------------
def transform_consent(df):
    df = df.copy()
    df.columns = df.iloc[0]     # first row → headers
    df = df[1:]                 # remove header row
    df = df.dropna(how="all")   # remove empty

    # Normalize column names
    df.columns = (
        df.columns.str.lower()
        .str.replace(" ", "_")
        .str.replace(r"[^a-z0-9_]", "", regex=True)
    )

    # build canonical record
    out = pd.DataFrame({
        "full_name": df.get("full_name", ""),
        "email": df.get("email_address", df.get("email", "")),
        "contact_number": df.get("contact_number", ""),
        "instagram_handle": df.get("instagram_username_optional", ""),
        "acquisition_source": df.get("booking_or_walkin"),
        "is_first_time": df.get("is_it_your_first_time_here_if_not_how_many_times_did_you_already_had_a_photo_session_with_us"),
        "registration_date": df.get("timestamp"),
        "consent": df.get("by_checking_the_i_agree_box_i_hereby_grant_permission_and_give_consent_to_heigen_studio_for_releasing_myour_photos_on_public__social_media_platforms"),
        "package": df.get("package_")
        })

    out["_raw"] = df.to_dict(orient="records")
    out["record_type"] = "consent"
    return out


# -------------------------
# FORMAT B: BOOKING BLOCKS
# -------------------------
def parse_price(text):
    if not isinstance(text, str):
        return 0
    nums = re.findall(r"\d+", text)
    return sum(map(int, nums)) if nums else 0


def extract_blocks(df):
    text = df.astype(str).agg(" ".join, axis=1)
    combined = " ".join(text)

    pattern = r"Client Number:\s*(\d+).*?Full Name:\s*(.*?)\s*Email:\s*(.*?)\s*Package:\s*(.*?)\s*Breakdown[^\d]*(.*?)\s*Gcash:\s*(\d+).*?Cash:\s*(\d+).*?TOTAL:\s*(\d+)"
    
    matches = re.findall(pattern, combined, flags=re.S)

    rows = []
    for m in matches:
        client_num, full_name, email, pkg, breakdown, gcash, cash, total = m

        rows.append({
            "client_number": int(client_num),
            "full_name": full_name.strip(),
            "email": email.strip(),
            "package_name": pkg.strip(),
            "base_price": parse_price(breakdown),
            "gcash_payment": float(gcash),
            "cash_payment": float(cash),
            "total_payment": float(total),
        })

    return pd.DataFrame(rows)


def transform_blocks(df):
    out = extract_blocks(df)
    out["_raw"] = out.to_dict(orient="records")
    out["record_type"] = "booking"
    return out


# -------------------------
# MAIN TRANSFORM SELECTOR
# -------------------------
def transform(df_raw):
    fmt = detect_format(df_raw)

    if fmt == "consent":
        print("📌 Format detected: CONSENT form")
        return transform_consent(df_raw)

    print("📌 Format detected: BOOKING blocks")
    return transform_blocks(df_raw)
