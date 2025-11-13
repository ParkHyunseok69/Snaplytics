from pathlib import Path
import argparse
from etl.scripts.extract import extract, checksum
from etl.scripts.transform import transform
from etl.scripts.load import insert_staging, merge_rows

def main():
    all_raw = extract()
    parser = argparse.ArgumentParser()
    parser.add_argument("--merge", action="store_true", help="Merge staging → final tables")
    args = parser.parse_args()

    

    for df_raw in all_raw:
        file_path = Path("etl/incoming") / df_raw["_source_file"].iloc[0]
        file_name = file_path.name
        file_checksum = checksum(file_path)
        df_transformed = transform(df_raw)
        insert_staging(df_transformed, file_name, file_checksum)

        print(f"\n=== Processing {file_name} ===")

        if args.merge:
            print("🔄 Running merge...")
            result = merge_rows(df_transformed, file_name)
            print(f"✅ Merge completed: {result}")
            return

        print(f"✅ Inserted into staging: {file_name}")



if __name__ == "__main__":
    main()
