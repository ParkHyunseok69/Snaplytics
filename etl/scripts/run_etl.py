# etl/scripts/run_etl.py
from pathlib import Path
import argparse
import shutil
import time

from etl.scripts.extract import extract, checksum
from etl.scripts.transform import transform
from etl.scripts.load import insert_staging, merge_consent, merge_bookings, engine

engine.dispose()
def move_processed(path: Path):
    dest = Path("etl/processed") / path.name

    for _ in range(10):   # retry 10 times
        try:
            shutil.move(str(path), str(dest))
            return
        except PermissionError:
            print(f"⚠️ File locked: {path.name} — retrying...")
            time.sleep(0.5)

    raise PermissionError(f"❌ Cannot move {path}, still locked after retries.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--merge", action="store_true")
    args = parser.parse_args()

    raw_files = extract()

    for df_raw in raw_files:
        file_path = Path("etl/incoming") / df_raw["_source_file"].iloc[0]
        file_name = file_path.name
        file_hash = checksum(file_path)

        df_can = transform(df_raw)

        # always insert into staging
        insert_staging(df_can, file_name, file_hash)

        if args.merge:
            if df_can["record_type"].iloc[0] == "consent":
                print("🔄 Merging CONSENT → customers ...")
                print(merge_consent(df_can))

            else:
                print("🔄 Merging BOOKINGS ...")
                print(merge_bookings(df_can))

        move_processed(file_path)


if __name__ == "__main__":
    main()
