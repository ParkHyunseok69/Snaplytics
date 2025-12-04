from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, PackageViewSet

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'packages', PackageViewSet, basename='package')
urlpatterns = [
 path('', include(router.urls)),
]