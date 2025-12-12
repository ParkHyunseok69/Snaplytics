from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, PackageViewSet
from .views import customer_recommendations

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'packages', PackageViewSet, basename='package')
urlpatterns = [
 path('', include(router.urls)),
 path("recommendations/<int:customer_id>/", customer_recommendations),
]