from django.db import models


class AppState(models.Model):
    key = models.CharField(max_length=50, unique=True, default="default")
    bank_tasks = models.JSONField(default=list)
    wheel_tasks = models.JSONField(default=list)
    presets = models.JSONField(default=list)
    is_muted = models.BooleanField(default=False)
    theme_mode = models.CharField(max_length=20, default="auto")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"AppState({self.key})"
