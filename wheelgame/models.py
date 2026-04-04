from django.db import models


class AppState(models.Model):
    key = models.CharField(max_length=50, unique=True, default="default")
    bank_tasks = models.JSONField(default=list)
    wheel_tasks = models.JSONField(default=list)
    presets = models.JSONField(default=list)
    is_muted = models.BooleanField(default=False)
    theme_mode = models.CharField(max_length=20, default="auto")
    updated_at = models.DateTimeField(auto_now=True)
    # Roles support (v2)
    roles_data = models.JSONField(default=dict)
    roles_password_hash = models.CharField(max_length=256, blank=True, default="")
    current_role = models.CharField(max_length=100, default="Yarin")

    def __str__(self):
        return f"AppState({self.key})"
