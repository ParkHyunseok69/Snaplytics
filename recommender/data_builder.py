import os
import pandas as pd

BOOKINGS_CSV = "ml/recommender/data/merged_bookings.csv"
BOOKING_ADDONS_CSV = "ml/recommender/data/booking_addons.csv"
OUT_RATINGS = "ml/recommender/data/surprise_ratings.csv"

def merge_addons_with_bookings_safe(bookings_df, addons_df, user_col='customer_id'):
    """
    Returns addons_df merged with user_id column by booking_id.
    - bookings_df: DataFrame with booking_id and user_col (customer_id or user_id)
    - addons_df: DataFrame with booking_id and addon_id
    """

    if 'booking_id' not in bookings_df.columns:
        raise ValueError("bookings_df must contain 'booking_id'")

    if user_col not in bookings_df.columns:
        raise ValueError(f"bookings_df must contain user column '{user_col}'")

    # parse session_date if present
    if 'session_date' in bookings_df.columns:
        bookings_df['session_date'] = pd.to_datetime(bookings_df['session_date'], errors='coerce')

    # dedupe booking_map (one row per booking_id). Prefer latest session_date.
    if 'session_date' in bookings_df.columns:
        booking_map = bookings_df.sort_values('session_date', ascending=False).drop_duplicates(subset=['booking_id'], keep='first')[
            ['booking_id', user_col]
        ]
    else:
        booking_map = bookings_df.drop_duplicates(subset=['booking_id'], keep='first')[['booking_id', user_col]]

    # warn if booking_id had conflicting users
    conflicts = bookings_df.groupby('booking_id')[user_col].nunique()
    conflict_count = (conflicts > 1).sum()
    if conflict_count > 0:
        print(f"WARNING: {conflict_count} booking_id(s) had multiple user ids; using latest per booking_id.")

    # merge
    merged = addons_df.merge(booking_map, on='booking_id', how='left', validate='m:1')

    # drop unmatched addon rows (no booking found)
    missing = merged[user_col].isna().sum()
    if missing > 0:
        print(f"WARNING: {missing} addon row(s) could not be linked to bookings and will be dropped.")
        merged = merged.dropna(subset=[user_col])

    # rename to user_id and return
    merged = merged.rename(columns={user_col: 'user_id'})
    merged['user_id'] = merged['user_id'].astype(str)
    return merged

def build_surprise_ratings_with_booking_addons(bookings_csv, booking_addons_csv, out_path):
    # Load files
    print("Loading bookings:", bookings_csv)
    bookings = pd.read_csv(bookings_csv, parse_dates=['session_date'], low_memory=False)
    print("Loading booking_addons:", booking_addons_csv)
    addons = pd.read_csv(booking_addons_csv, low_memory=False)

    # Validate columns
    if 'booking_id' not in bookings.columns:
        raise ValueError(f"{bookings_csv} must contain 'booking_id'")
    if not ('customer_id' in bookings.columns or 'user_id' in bookings.columns):
        raise ValueError(f"{bookings_csv} must contain 'customer_id' or 'user_id' column")
    if 'booking_id' not in addons.columns or 'addon_id' not in addons.columns:
        raise ValueError(f"{booking_addons_csv} must contain 'booking_id' and 'addon_id' columns")

    # choose user column name
    user_col = 'customer_id' if 'customer_id' in bookings.columns else 'user_id'

    # Merge addons -> bookings to get user_id per addon row
    addons_merged = merge_addons_with_bookings_safe(bookings, addons, user_col=user_col)

    # Build addon interactions (one per addon row after merging)
    addon_interactions = addons_merged[['user_id', 'addon_id']].drop_duplicates().copy()
    addon_interactions['item_id'] = addon_interactions['addon_id'].apply(lambda x: f"addon::{x}")

    # Build package interactions (one per user-package pair)
    package_interactions = bookings[[user_col, 'package_id']].dropna().drop_duplicates().rename(columns={user_col: 'user_id'}).copy()
    package_interactions['item_id'] = package_interactions['package_id'].astype(str)

    # Combine interactions
    interactions = pd.concat(
        [package_interactions[['user_id', 'item_id']], addon_interactions[['user_id', 'item_id']]],
        ignore_index=True,
        sort=False
    )

    # implicit positive rating
    interactions['rating'] = 1

    # ensure strings
    interactions['user_id'] = interactions['user_id'].astype(str)
    interactions['item_id'] = interactions['item_id'].astype(str)

    # write
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    interactions.to_csv(out_path, index=False)
    print("WROTE:", out_path)
    return interactions

if __name__ == "__main__":
    if not os.path.exists(BOOKING_ADDONS_CSV):
        raise FileNotFoundError(f"{BOOKING_ADDONS_CSV} not found. Please add booking_addons.csv.")
    build_surprise_ratings_with_booking_addons(BOOKINGS_CSV, BOOKING_ADDONS_CSV, OUT_RATINGS)