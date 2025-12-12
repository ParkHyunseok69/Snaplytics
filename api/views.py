from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from backend.models import Customer, Package
from .serializers import CustomerSerializer, PackageSerializer
from rest_framework.decorators import api_view
from rest_framework.response import Response
from recommender.service import get_recommendations
from datetime import datetime

class CustomerViewSet(viewsets.ModelViewSet):
 """
 GET /api/customers/ -> list customers
 GET /api/customers/{id}/ -> retrieve one
 POST /api/customers/ -> create
 PUT /api/customers/{id}/ -> full update
 PATCH /api/customers/{id}/ -> partial update
 DELETE /api/customers/{id}/ -> delete
 """
 queryset = Customer.objects.all().order_by('-created_at')
 serializer_class = CustomerSerializer
 permission_classes = [IsAuthenticatedOrReadOnly]
class PackageViewSet(viewsets.ModelViewSet):
 """
 Same CRUD mapping as CustomerViewSet but for packages.
 """
 queryset = Package.objects.filter()
 serializer_class = PackageSerializer
 permission_classes = [IsAuthenticatedOrReadOnly]



@api_view(["GET"])
def customer_recommendations(request, customer_id):
    recos = get_recommendations(customer_id, datetime.now())

    return Response({
        "customer_id": customer_id,
        "recommendations": recos
    })