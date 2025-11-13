from pathlib import Path
import pandas as pd
import hashlib

INCOMING = Path(__file__).resolve().parent.parent / "incoming"

def _find_file():
    files = sorted(INCOMING.glob("*.xlsx"))
    if not files:
        raise FileNotFoundError("No .xlsx files in /etl/incoming")
    return files[0]

def checksum(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()

def extract() -> list[pd.DataFrame]:
    files = sorted(INCOMING.glob("*.xlsx"))

    if not files:
        raise FileNotFoundError("No .xlsx files found in etl/incoming")

    dataframes = []

    for fpath in files:
        print(f"\n🔍 Loading file: {fpath.name}")

        xls = pd.ExcelFile(fpath)
        for sheet in xls.sheet_names:
            try:
                df = pd.read_excel(fpath, sheet_name=sheet, header=None)
                df["_source_file"] = fpath.name
                df["_sheet_name"] = sheet
                dataframes.append(df)
                print(f"     ✅ Loaded sheet: {sheet}")
            except Exception as e:
                print(f"     ⚠️ Skipped sheet {sheet}: {e}")

    return dataframes

