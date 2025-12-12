# recommender/popularity_builder.py  (PATCHED)
import os
import pandas as pd

BOOKINGS_CSV = "ml/recommender/data/merged_bookings.csv"
BOOKING_ADDONS_CSV = "ml/recommender/data/booking_addons.csv"
OUT_DIR = "ml/recommender/artifacts"

os.makedirs(OUT_DIR, exist_ok=True)

def build_monthly_popularity(bookings_csv, booking_addons_csv, out_dir):
    bookings = pd.read_csv(bookings_csv, parse_dates=['session_date'], low_memory=False)
    bookings['month'] = bookings['session_date'].dt.to_period('M').astype(str)

    # PACKAGE POPULARITY
    pkg = bookings.groupby(['month', 'package_id']).size().reset_index(name='count')
    pkg = pkg.sort_values(['month', 'count'], ascending=[True, False])
    pkg.to_csv(os.path.join(out_dir, "month_package_popularity.csv"), index=False)
    print("WROTE:", os.path.join(out_dir, "month_package_popularity.csv"))

    # USER MONTHLY SUMMARY
    user_col = 'customer_id' if 'customer_id' in bookings.columns else 'user_id'
    user_month = bookings.groupby(['month', user_col]).agg(packages=('package_id', 'nunique')).reset_index()
    user_month.to_csv(os.path.join(out_dir, "user_monthly_summary.csv"), index=False)
    print("WROTE:", os.path.join(out_dir, "user_monthly_summary.csv"))

    # ADDON POPULARITY & PACKAGE-ADDON COOCCURRENCE (safe merge)
    if os.path.exists(booking_addons_csv):
        addons = pd.read_csv(booking_addons_csv, low_memory=False)

        # build booking_map deduped (one row per booking_id). Prefer latest session_date.
        if 'session_date' in bookings.columns:
            bookings['session_date'] = pd.to_datetime(bookings['session_date'], errors='coerce')
            booking_map = bookings.sort_values('session_date', ascending=False).drop_duplicates(subset=['booking_id'], keep='first')[['booking_id', 'month', 'package_id']]
        else:
            booking_map = bookings.drop_duplicates(subset=['booking_id'], keep='first')[['booking_id', 'month', 'package_id']]

        # warn about conflicts
        conflicts = bookings.groupby('booking_id')['package_id'].nunique()
        conflict_count = (conflicts > 1).sum()
        if conflict_count > 0:
            print(f"WARNING: {conflict_count} booking_id(s) had multiple package_id values. Using latest per booking_id for mapping.")

        # merge many addons -> one booking_map
        addons = addons.merge(booking_map, on='booking_id', how='left', validate='m:1')

        # drop unmatched addon rows
        missing = addons['month'].isna().sum()
        if missing > 0:
            print(f"WARNING: {missing} addon rows couldn't be linked to bookings. Dropping them for popularity.")
            addons = addons.dropna(subset=['month'])

        # addon popularity
        addon_pop = addons.groupby(['month', 'addon_id']).size().reset_index(name='count')
        addon_pop = addon_pop.sort_values(['month', 'count'], ascending=[True, False])
        addon_pop.to_csv(os.path.join(out_dir, "month_addon_popularity.csv"), index=False)
        print("WROTE:", os.path.join(out_dir, "month_addon_popularity.csv"))

        # package-addon cooccurrence
        coocc = addons.groupby(['month', 'package_id', 'addon_id']).size().reset_index(name='count')
        coocc = coocc.sort_values(['month', 'count'], ascending=[True, False])
        coocc.to_csv(os.path.join(out_dir, "month_package_addon_cooccurrence.csv"), index=False)
        print("WROTE:", os.path.join(out_dir, "month_package_addon_cooccurrence.csv"))
    else:
        print("No booking_addons.csv present — skipping addon popularity and cooccurrence files.")

if __name__ == "__main__":
    build_monthly_popularity(BOOKINGS_CSV, BOOKING_ADDONS_CSV, OUT_DIR)
