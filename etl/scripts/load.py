import pandas as pd
from django.db import transaction
from django.utils.timezone import make_aware
from datetime import datetime
import numpy as np
import re
import logging

from backend.models import (
    Customer,
    Package,
    Booking,
    Addon,
    BookingAddon,
    StagingBooking
)

logger = logging.getLogger(__name__)


# ============================================================
#  JSON CLEANER
# ============================================================
def clean_json(obj):
    if obj is None:
        return None
    if isinstance(obj, float) and pd.isna(obj):
        return None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.ndarray, list)):
        return [clean_json(x) for x in obj]
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {str(k): clean_json(v) for k, v in obj.items()}
    if isinstance(obj, (int, float, str, bool)):
        return obj
    return str(obj)


# ============================================================
#   STAGING
# ============================================================
def insert_staging(df, file_name, checksum):
    for i, row in df.iterrows():
        raw_clean = clean_json(row["_raw"])
        canonical_clean = clean_json({
            k: v for k, v in row.items() if k not in ["_raw"]
        })

        StagingBooking.objects.create(
            file_name=file_name,
            file_checksum=checksum,
            raw_row_number=i + 1,
            raw_data=raw_clean,
            canonical_data=canonical_clean,
            processing_status="PENDING",
        )


# ============================================================
#   CONSENT MERGE
# ============================================================
def parse_prev_sessions(value):
    if value is None or str(value).strip() == "" or str(value).lower() == "nan":
        return 0
    digits = re.sub(r"\D", "", str(value))
    return int(digits) if digits else 0


def merge_consent(df):
    merged = 0

    with transaction.atomic():
        for _, r in df.iterrows():

            raw_date = r.get("registration_date")
            registration_date = None

            if raw_date and str(raw_date).lower() not in ["nan", "none", ""]:
                try:
                    if isinstance(raw_date, str):
                        registration_date = make_aware(datetime.fromisoformat(raw_date))
                except:
                    registration_date = None

            is_first_time = r.get("is_first_time")
            if is_first_time == "First time":
                is_first_time_final = True
                psc = 0
            else:
                is_first_time_final = False
                psc = parse_prev_sessions(is_first_time)

            Customer.objects.update_or_create(
                email=r["email"],
                defaults={
                    "full_name": r["full_name"],
                    "contact_number": r["contact_number"],
                    "instagram_handle": r["instagram_handle"],
                    "acquisition_source": r["acquisition_source"],
                    "is_first_time": is_first_time_final,
                    "previous_session_counts": psc,
                    "registration_date": registration_date,
                    "consent": r["consent"],
                    "package": r["package"],
                }
            )

            merged += 1

    return merged


# ============================================================
# ADDON NORMALIZATION
# ============================================================

OFFICIAL_ADDONS = [
    "Additional Person",
    "Additional 10 minutes",
    "Additional Backdrop",
    "Whole-Body Backdrop",
    "Onesie Pajama rent (1 design)",
    "LARGE Birthday Balloons Number 0 to 9",
    "All Soft Copies",
    "Single Soft Copy",
    "Additional Wallet Size (Hardcopy)",
    "Additional A4 Size (Hardcopy)",
    "Additional A6 size (Hardcopy)",
    "Additional Photo-Strip",
    "Additional Instax-Mini Inspired (Hardcopy)",
    "Whole Body Picture",
    "Additional 4r Size (Hardcopy)",
    "Spotlight",
    "Yearbook Props",
    "Yearbook Uniforms",
    "Get all soft copies",
    "2 Photostrips",
    "Add 10 minutes",
    "Wallet Size",
    "A6 size",
    "Additional 1 Edited Photo",
    "Barkada/Family Shots",
    "Couple Shots",
    "5x7 Print",
    "8x10 Print",
    "4x6 Print",
    "Glass Frame (Small 8x10 Photo) with Heigen Studio Bag",
    "Soft Copy (ID)",
]

ADDON_ALIAS = {
    "all softcopies": "All Soft Copies",
    "all soft copies": "All Soft Copies",
    "soft copy": "Single Soft Copy",
    "softcopy": "Single Soft Copy",
    "soft copies": "All Soft Copies",
    "softcopies": "All Soft Copies",
    "onesie": "Onesie Pajama rent (1 design)",
    "onesies": "Onesie Pajama rent (1 design)",
    "10 mins": "Additional 10 minutes",
    "10 minutes": "Additional 10 minutes",
    "add 10 minutes": "Additional 10 minutes",
    "additional 10": "Additional 10 minutes",
    "wallet": "Additional Wallet Size (Hardcopy)",
    "wallet size": "Additional Wallet Size (Hardcopy)",
    "photostrip": "Additional Photo-Strip",
    "photo strip": "Additional Photo-Strip",
    "whole body backdrop": "Whole-Body Backdrop",
    "whole-body": "Whole-Body Backdrop",
    "backdrop": "Additional Backdrop",
    "2 photostrips": "2 Photostrips",
    "a6": "Additional A6 size (Hardcopy)",
    "4r": "Additional 4r Size (Hardcopy)",
    "5x7": "5x7 Print",
    "8x10": "8x10 Print",
    "4x6": "4x6 Print",
    "spotlight": "Spotlight",
}


def normalize_addon_name(name):
    if not name:
        return ""
    n = name.lower().strip()
    for alias, canonical in ADDON_ALIAS.items():
        if alias in n:
            return canonical
    for official in OFFICIAL_ADDONS:
        if official.lower() in n:
            return official
    return name.strip()


def extract_addon_names(text):
    if not text or str(text).lower() == "nan":
        return []
    parts = [p.strip() for p in str(text).replace("\n", " ").split("+") if p.strip()]
    return [normalize_addon_name(p) for p in parts]


def extract_prices(text):
    if not text or str(text).lower() == "nan":
        return []
    nums = re.findall(r"\d+\.?\d*", str(text))
    return [float(n) for n in nums]


def clean_breakdown(names, prices):
    addon_names = extract_addon_names(names)
    if not addon_names:
        return [], []
    addon_names = addon_names[1:]  # skip package name
    addon_prices = extract_prices(prices)[1:]
    while len(addon_prices) < len(addon_names):
        addon_prices.append(None)
    return addon_names, addon_prices


# ============================================================
# BOOKING ADDONS (DJANGO VERSION)
# ============================================================
def insert_booking_addons(booking, addon_names, addon_prices):
    BookingAddon.objects.filter(booking=booking).delete()

    for idx, name in enumerate(addon_names):
        if not name:
            continue

        try:
            addon_obj = Addon.objects.get(name__iexact=name)
        except Addon.DoesNotExist:
            logger.warning(f"Addon not found: {name}")
            continue

        price = addon_prices[idx] if idx < len(addon_prices) else None
        if price is None:
            logger.warning(f"Missing price for addon '{name}'")
            continue

        # determine quantity
        if addon_obj.price in [None, 0]:
            qty = 1
            unit_price = price
        else:
            ratio = price / addon_obj.price
            if abs(ratio - round(ratio)) < 1e-6:
                qty = int(round(ratio))
                unit_price = addon_obj.price
            else:
                qty = 2
                unit_price = price

        total = qty * unit_price

        BookingAddon.objects.update_or_create(
            booking=booking,
            addon=addon_obj,
            defaults={
                "addon_quantity": qty,
                "addon_price": unit_price,
                "total_addon_cost": total
            }
        )


# ============================================================
# BOOKING MERGE
# ============================================================
def merge_bookings(df):
    merged = 0

    with transaction.atomic():
        for _, r in df.iterrows():
            full_name = r.get("full_name")
            email = r.get("email")
            package_name = r.get("package")

            # ------------------------------
            # FIND CUSTOMER
            # ------------------------------

            customer = None
            if email:
                customer = Customer.objects.filter(email__iexact=email).first()

            if not customer and full_name:
                customer = Customer.objects.filter(full_name__iexact=full_name).first()

            if not customer:
                customer = Customer.objects.create(
                    full_name=full_name or None,
                    email=email or None,
                )

            # ------------------------------
            # FIND OR CREATE PACKAGE
            # ------------------------------

            package = None
            if package_name:
                package = Package.objects.filter(name__iexact=package_name).first()

            if not package:
                package = Package.objects.create(name=package_name, price=None)

            # ------------------------------
            # SESSION DATE
            # ------------------------------

            sd = r.get("session_date")
            try:
                if isinstance(sd, str):
                    sd = make_aware(datetime.fromisoformat(sd))
            except:
                sd = None

            booking = Booking.objects.create(
                customer=customer,
                package=package,
                session_date=sd,
                total_price=r.get("total"),
                gcash_payment=r.get("gcash"),
                cash_payment=r.get("cash"),
                discounts=str(r.get("discounts")),
                session_status="BOOKED",
            )

            # ------------------------------
            # ADDONS
            # ------------------------------

            addon_names, addon_prices = clean_breakdown(
                r.get("breakdown_of_package"),
                r.get("breakdown_pricing")
            )

            insert_booking_addons(booking, addon_names, addon_prices)

            merged += 1

    return merged
