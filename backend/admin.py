from django.contrib import admin
from .models import Customer, Package, Addon, Booking, BookingAddon, Renewal

admin.site.register(Customer)
admin.site.register(Package)
admin.site.register(Addon)
admin.site.register(Booking)
admin.site.register(BookingAddon)
admin.site.register(Renewal)
