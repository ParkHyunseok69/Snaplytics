# transform.py
import pandas as pd
import re
from pathlib import Path
import yaml

MAP_FILE = Path("etl/config/column_mapping.yaml")

def _load_mapping():
    if MAP_FILE.exists():
        return yaml.safe_load(open(MAP_FILE)).get("excel_to_db_mapping", {})
    return {}

def detect_format(df: pd.DataFrame) -> str:
    cols = [str(c).lower().strip() for c in df.columns]

    print("\n🟦 DEBUG: detected columns for this sheet:")
    for c in cols:
        print("   →", c)

    # ✅ check Format A
    format_a_keywords = ["timestamp", "email", "full name", "package"]
    if any(k in cols for k in format_a_keywords):
        return "A"

    # ✅ check Format B inside sheet contents (not just headers)
    sheet_as_text = df.to_string().lower()
    if "client number" in sheet_as_text or "package" in sheet_as_text:
        return "B"

    raise ValueError(
        f"Unknown Excel format — no match for A or B\n"
        f"Detected columns: {cols}"
    )


def extract_date_from_format_b(df: pd.DataFrame):
    # Flatten the sheet into a single column string search
    for col in df.columns:
        for val in df[col]:
            if isinstance(val, str) and "/" in val:
                # example detected "05/01/25"
                return val.strip()
    return None


def parse_currency(x):
    if pd.isna(x): return 0.0
    s = str(x)
    s = re.sub(r"[^\d.\-]", "", s)
    try:
        return float(s) if s != "" else 0.0
    except:
        return 0.0

def transform(df: pd.DataFrame) -> pd.DataFrame:
    mapping = _load_mapping()
    df = df.rename(columns=mapping)
    fmt = detect_format(df)

    # base canonical columns
    canonical = pd.DataFrame()
    canonical["_raw"] = df.apply(lambda r: r.to_dict(), axis=1)
    canonical["file_name"] = df.get("_source_file")
    canonical["sheet_name"] = df.get("_sheet_name")

    if fmt == "A":
        # Format A: blocks / styled cells - try to pick columns if present
        canonical["full_name"] = df.get("Full Name") if "Full Name" in df.columns else df.get("full_name") or df.get("Name")
        canonical["email"] = df.get("Email") if "Email" in df.columns else df.get("email")
        canonical["package_name"] = df.get("Package") if "Package" in df.columns else df.get("package_name")
        canonical["session_date"] = pd.to_datetime(df.get("Date"), errors="coerce")
        canonical["base_price"] = df.get("TOTAL") if "TOTAL" in df.columns else df.get("Total Paid") if "Total Paid" in df.columns else df.get("total_amount")
        canonical["base_price"] = canonical["base_price"].apply(parse_currency)
        # payments fallback
        canonical["gcash_payment"] = df.get("Gcash", 0).apply(parse_currency) if "Gcash" in df.columns else 0.0
        canonical["cash_payment"] = df.get("Cash", 0).apply(parse_currency) if "Cash" in df.columns else 0.0
        # addons: try parse Addon or Breakdown of Price
        canonical["addon_raw"] = df.get("Breakdown of Price") if "Breakdown of Price" in df.columns else df.get("Breakdown Price") if "Breakdown Price" in df.columns else None

    else:
        # ----------- FORMAT B LOGIC (Card Layout) -----------
        sheet_date = extract_date_from_format_b(df)   # << NEW
        canonical["session_date"] = pd.to_datetime(sheet_date, errors="coerce")  # << NEW

        canonical["full_name"] = df.get("full_name") or df.get("Full Name") or df.get("name")
        canonical["email"] = df.get("email") or df.get("Email")
        canonical["package_name"] = df.get("package_name") or df.get("Package")
        canonical["base_price"] = df.get("total_amount") or df.get("Total Paid") or df.get("amount")
        canonical["base_price"] = canonical["base_price"].apply(parse_currency)

        canonical["payment_method"] = df.get("payment_method") or df.get("Payment Type")
        canonical["gcash_payment"] = df.get("gcash_payment") if "gcash_payment" in df.columns else 0.0
        canonical["cash_payment"] = df.get("cash_payment") if "cash_payment" in df.columns else 0.0
        canonical["addon_raw"] = df.get("addon") if "addon" in df.columns else df.get("Addon")


    # normalise text
    for c in ["full_name","email","package_name"]:
        if c in canonical.columns:
            canonical[c] = canonical[c].astype(str).str.strip().replace({'nan':None})

    # Add helper: canonical["business_key"] to detect duplicates later
    canonical["business_key"] = canonical.apply(lambda r: f"{(r.email or '').lower()}|{(r.package_name or '').lower()}|{str(r.session_date)}|{r.base_price}", axis=1)

    return canonical
