import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import AppState


def index(request):
    return render(request, "wheelgame/index.html")


def health(request):
    return JsonResponse({"status": "ok", "service": "wheelgame-backend"})


def _serialize_state(state):
    return {
        "bankTasks": state.bank_tasks,
        "wheelTasks": state.wheel_tasks,
        "isMuted": state.is_muted,
        "themeMode": state.theme_mode,
        "updatedAt": state.updated_at.isoformat() if state.updated_at else None,
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def state(request):
    app_state, _ = AppState.objects.get_or_create(key="default")

    if request.method == "GET":
        return JsonResponse({"state": _serialize_state(app_state)})

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)

    bank_tasks = payload.get("bankTasks")
    wheel_tasks = payload.get("wheelTasks")
    is_muted = payload.get("isMuted")
    theme_mode = payload.get("themeMode")

    if not isinstance(bank_tasks, list) or not isinstance(wheel_tasks, list):
        return JsonResponse(
            {"error": "bankTasks and wheelTasks must be arrays."}, status=400
        )
    if not isinstance(is_muted, bool):
        return JsonResponse({"error": "isMuted must be boolean."}, status=400)
    if theme_mode not in {"auto", "morning", "dawn", "sunset", "night"}:
        return JsonResponse({"error": "themeMode is invalid."}, status=400)

    app_state.bank_tasks = bank_tasks
    app_state.wheel_tasks = wheel_tasks
    app_state.is_muted = is_muted
    app_state.theme_mode = theme_mode
    app_state.save(update_fields=["bank_tasks", "wheel_tasks", "is_muted", "theme_mode", "updated_at"])

    return JsonResponse({"status": "ok", "state": _serialize_state(app_state)})
