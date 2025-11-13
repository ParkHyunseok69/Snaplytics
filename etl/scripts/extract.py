# etl/scripts/extract.py
import pandas as pd
from pathlib import Path
import hashlib

INCOMING = Path("etl/incoming")

def checksum(path: Path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()

def extract():
    dfs = []
    for path in INCOMING.glob("*.xlsx"):
        print(f"📄 Reading {path.name} ...")
        try:
            xls = pd.ExcelFile(path)
            for sheet in xls.sheet_names:
                df = pd.read_excel(path, sheet_name=sheet, header=None)
                df["_source_file"] = path.name
                df["_sheet_name"] = sheet
                dfs.append(df)
        except Exception as e:
            print(f"❌ Error reading {path.name}: {e}")
            continue
    return dfs
