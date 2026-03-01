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
        "presets": state.presets,
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
    presets = payload.get("presets", [])
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
    if not isinstance(presets, list):
        return JsonResponse({"error": "presets must be an array."}, status=400)
    for preset in presets:
        if not isinstance(preset, dict):
            return JsonResponse({"error": "preset item must be an object."}, status=400)
        if not isinstance(preset.get("id"), str) or not preset.get("id").strip():
            return JsonResponse({"error": "preset id must be non-empty string."}, status=400)
        if not isinstance(preset.get("name"), str) or not preset.get("name").strip():
            return JsonResponse({"error": "preset name must be non-empty string."}, status=400)
        item_labels = preset.get("itemLabels")
        if not isinstance(item_labels, list) or not all(
            isinstance(label, str) for label in item_labels
        ):
            return JsonResponse(
                {"error": "preset itemLabels must be an array of strings."}, status=400
            )

    app_state.bank_tasks = bank_tasks
    app_state.wheel_tasks = wheel_tasks
    app_state.presets = presets
    app_state.is_muted = is_muted
    app_state.theme_mode = theme_mode
    app_state.save(
        update_fields=[
            "bank_tasks",
            "wheel_tasks",
            "presets",
            "is_muted",
            "theme_mode",
            "updated_at",
        ]
    )

    return JsonResponse({"status": "ok", "state": _serialize_state(app_state)})
