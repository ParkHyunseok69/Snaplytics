from django.db import models
from django.utils import timezone



class Package(models.Model):
    category = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    price = models.FloatField()
    promo_price = models.FloatField(null=True, blank=True)
    promo_price_condition = models.TextField(null=True, blank=True)
    max_people = models.IntegerField(null=True, blank=True)
    inclusions = models.JSONField(null=True, blank=True)
    included_portraits = models.JSONField(null=True, blank=True)
    freebies = models.JSONField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name

class Customer(models.Model):
    customer_id = models.AutoField(primary_key=True)
    full_name = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    contact_number = models.CharField(max_length=50, null=True, blank=True)
    instagram_handle = models.CharField(max_length=255, null=True, blank=True)
    acquisition_source = models.CharField(max_length=255, null=True, blank=True)
    is_first_time = models.BooleanField(null=True, blank=True)
    previous_session_counts = models.IntegerField(null=True, blank=True)
    registration_date = models.DateTimeField(null=True, blank=True)
    consent = models.TextField(null=True, blank=True)
    package = models.ForeignKey(Package, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)


    def __str__(self):
        return self.full_name or "Customer"

class Addon(models.Model):
    name = models.CharField(max_length=255)
    price = models.FloatField()
    additional_info = models.TextField(null=True, blank=True)
    applies_to = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name


class Booking(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="bookings")
    package = models.ForeignKey(Package, on_delete=models.SET_NULL, null=True)
    session_date = models.DateTimeField(null=True, blank=True)
    total_price = models.FloatField(null=True, blank=True)
    gcash_payment = models.FloatField(null=True, blank=True)
    cash_payment = models.FloatField(null=True, blank=True)
    discounts = models.TextField(null=True, blank=True)
    session_status = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)


class BookingAddon(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE)
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE)
    addon_quantity = models.IntegerField()
    addon_price = models.FloatField()
    total_addon_cost = models.FloatField()
    created_at = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)


class Renewal(models.Model):
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE)
    total_bookings = models.IntegerField()
    avg_booking_value = models.FloatField()
    booking_frequency = models.FloatField()
    renewed_within_365 = models.BooleanField()
    total_spent = models.FloatField()
    preferred_package_type = models.CharField(max_length=255)
    created_at = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)

class StagingBooking(models.Model):
    file_name = models.CharField(max_length=255)
    file_checksum = models.CharField(max_length=255)
    raw_row_number = models.IntegerField()
    raw_data = models.JSONField()
    canonical_data = models.JSONField()
    processing_status = models.CharField(max_length=30, default="PENDING")
    created_at = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)