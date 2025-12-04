from rest_framework import serializers
from backend.models import Customer, Package

class CustomerSerializer(serializers.ModelSerializer):
 class Meta:
    model = Customer
    fields = ['customer_id', 'full_name', 'email', 'contact_number', 'package']
class PackageSerializer(serializers.ModelSerializer):
 class Meta:
    model = Package
    fields = ['id', 'name', 'category', 'price', 'promo_price', 
              'promo_price_condition', 'inclusions', 'included_portraits', 'freebies']