from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/health/", views.health, name="health"),
    path("api/state/", views.state, name="state"),
    path("api/roles/set-password/", views.set_roles_password, name="set_roles_password"),
    path("api/roles/verify-password/", views.verify_roles_password, name="verify_roles_password"),
]
