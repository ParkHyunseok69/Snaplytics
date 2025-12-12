# recommender/service.py (patched to use multi-addon loader)
from pyspark.sql import Row
from .loader import load_model, recommend_for_user, load_popularity_tables
from pyspark import get_spark
from .popularity_builder import build_monthly_popularity as build_popularity_tables
from backend.models import BookingAddon
from collections import defaultdict, Counter
import logging
import datetime
import pandas as pd

logger = logging.getLogger(__name__)

# Lazy caches — NOT computed at import time
_popular_packages_cache = None
_popular_combos_cache = None
_addon_counts_cache = None


def get_popularity_tables():
    global _popular_packages_cache, _popular_combos_cache
    if _popular_packages_cache is None or _popular_combos_cache is None:
        # build_popularity_tables used in other contexts writes artifacts - keep interface compatibility
        # We expect build_popularity_tables / popularity_builder to create CSV artifacts already,
        # but returning an in-memory mapping here is useful in tests/interactive mode.
        try:
            # try building (no-op if artifacts already exist)
            build_popularity_tables("ml/recommender/data/merged_bookings.csv", "ml/recommender/data/booking_addons.csv", "ml/recommender/artifacts")
        except Exception:
            # ignore; we'll load artifacts below
            pass
        tables = load_popularity_tables()
        _popular_packages_cache = tables.get('package', None)
        _popular_combos_cache = tables.get('cooccurrence', None)
    return _popular_packages_cache, _popular_combos_cache


def get_addon_counts():
    global _addon_counts_cache
    if _addon_counts_cache is None:
        addon_counts = defaultdict(Counter)
        for ba in BookingAddon.objects.select_related("booking"):
            pkg = ba.booking.package_id
            if pkg:
                addon_counts[pkg][ba.addon_id] += ba.addon_quantity or 1
        _addon_counts_cache = addon_counts
    return _addon_counts_cache


def recommend_packages(customer_id, k=3):
    # Spark & model are initialized lazily inside the function (safe in Django)
    spark = get_spark()
    model = load_model()

    user_df = spark.createDataFrame([Row(user=int(customer_id))])
    rec = model.recommendForUserSubset(user_df, k).collect()

    if not rec:
        return []

    return [(r.item, float(r.rating)) for r in rec[0].recommendations]


def get_top_addons_for_package(package_id, top_m=2):
    addon_counts = get_addon_counts()
    counts = addon_counts.get(package_id)
    if not counts:
        return []
    return [a for a, c in counts.most_common(top_m)]


def get_recommendations(customer_id, target_date, k=3):
    """
    Updated flow:
    1) Try personalized Surprise/Spark models (if available) for package candidates.
       If using Spark ALS for packages, we still want multi-addons per picked package:
       - we use get_top_addons_for_package as a fast fallback for addons if Surprise not used;
       - but when Surprise SVD++ model is available via loader.recommend_for_user, we prefer that.
    2) Fallback to popularity combos (month).
    """
    try:
        # prefer our ml/recommender loader (it handles Surprise model + multi-addons greedily)
        algo = None
        try:
            algo = load_model()
        except Exception:
            algo = None
        tables = load_popularity_tables()  # this reads artifacts CSVs into DataFrames
        month_key = target_date.strftime("%Y-%m") if isinstance(target_date, (datetime.date, datetime.datetime)) else str(target_date)

        # call the loader-level recommend_for_user which returns multi-addons sets
        rec = recommend_for_user(algo, customer_id, {'package': tables.get('package', pd.DataFrame()),
                                                     'addon': tables.get('addon', pd.DataFrame()),
                                                     'cooccurrence': tables.get('cooccurrence', pd.DataFrame())},
                                 month=month_key, alpha=0.6, top_k=k)
        # If loader returns fallback dict with 'user_id': None, it still contains recommendations
        if rec and 'recommendations' in rec:
            out = []
            for (pkg, addons), score in rec['recommendations']:
                out.append({
                    "package_id": pkg,
                    "addon_ids": list(addons),
                    "score": float(score),
                    "source": rec.get('source', 'loader')
                })
            if out:
                return out[:k]
    except Exception as e:
        logger.exception("Loader-based recommendation failed; falling back to older service logic.")

    # Older fallback logic (Spark ALS + addon counts)
    try:
        pkg_scores = recommend_packages(customer_id, k)
    except Exception:
        logger.exception("ALS recommendation failed; falling back to popularity")
        pkg_scores = []

    if pkg_scores:
        combos = []
        for pkg, score in pkg_scores:
            addons = get_top_addons_for_package(pkg)
            combos.append({
                "package_id": pkg,
                "addon_ids": addons,
                "score": score,
                "source": "ALS"
            })
        return combos[:k]

    # 2) Popular combos fallback (if present)
    popular_packages_by_month, popular_combos_by_month = get_popularity_tables()
    month_key = target_date.strftime("%Y-%m")
    if popular_combos_by_month is not None and month_key in (popular_combos_by_month.index if hasattr(popular_combos_by_month, 'index') else []):
        # If build_popularity_tables returns a mapping, adapt accordingly. Here we fall back to reading artifact CSV.
        pass

    # 3) Popular packages fallback
    if popular_packages_by_month is not None:
        # assume DataFrame with ('month','package_id','count')
        if hasattr(popular_packages_by_month, 'loc'):
            df = popular_packages_by_month
            if 'month' in df.columns:
                rows = df[df['month'] == month_key].sort_values('count', ascending=False).head(k)
                return [{"package_id": r['package_id'], "addon_ids": [], "score": float(r['count']), "source": "popular_package"} for _, r in rows.iterrows()]
            else:
                rows = df.sort_values('count', ascending=False).head(k)
                return [{"package_id": r['package_id'], "addon_ids": [], "score": float(r['count']), "source": "popular_package"} for _, r in rows.iterrows()]

    return []
