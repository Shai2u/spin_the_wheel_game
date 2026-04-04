import hashlib
import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import AppState

VALID_THEME_MODES = {"auto", "morning", "dawn", "sunset", "night"}


def _hash_password(password: str) -> str:
    return hashlib.sha256(f"wg_{password}".encode()).hexdigest()


def _migrate_roles_if_needed(app_state):
    """On first access after the roles migration, seed Yarin's data from the flat fields."""
    if not app_state.roles_data:
        app_state.roles_data = {
            "Yarin": {
                "bankTasks": app_state.bank_tasks,
                "wheelTasks": app_state.wheel_tasks,
                "presets": app_state.presets,
            }
        }
        app_state.current_role = "Yarin"
        app_state.save(update_fields=["roles_data", "current_role"])


def _serialize_state(state):
    _migrate_roles_if_needed(state)
    roles_data = state.roles_data or {}
    current_role = state.current_role or "Yarin"
    role_data = roles_data.get(current_role, {})

    return {
        "bankTasks": role_data.get("bankTasks", state.bank_tasks),
        "wheelTasks": role_data.get("wheelTasks", state.wheel_tasks),
        "presets": role_data.get("presets", state.presets),
        "isMuted": state.is_muted,
        "themeMode": state.theme_mode,
        "rolesData": roles_data,
        "rolesPasswordSet": bool(state.roles_password_hash),
        "currentRole": current_role,
        "updatedAt": state.updated_at.isoformat() if state.updated_at else None,
    }


def index(request):
    return render(request, "wheelgame/index.html")


def health(request):
    return JsonResponse({"status": "ok", "service": "wheelgame-backend"})


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

    # Roles data (optional — clients that don't send it keep existing roles)
    roles_data = payload.get("rolesData")
    current_role = payload.get("currentRole", app_state.current_role or "Yarin")

    if roles_data is not None:
        if not isinstance(roles_data, dict):
            return JsonResponse({"error": "rolesData must be an object."}, status=400)
        app_state.roles_data = roles_data
        app_state.current_role = current_role

    # Fall back to per-role data from rolesData, or top-level fields for old clients
    if roles_data and current_role in roles_data:
        role = roles_data[current_role]
        bank_tasks = role.get("bankTasks", payload.get("bankTasks", app_state.bank_tasks))
        wheel_tasks = role.get("wheelTasks", payload.get("wheelTasks", app_state.wheel_tasks))
        presets = role.get("presets", payload.get("presets", app_state.presets))
    else:
        bank_tasks = payload.get("bankTasks", app_state.bank_tasks)
        wheel_tasks = payload.get("wheelTasks", app_state.wheel_tasks)
        presets = payload.get("presets", app_state.presets)

    is_muted = payload.get("isMuted", app_state.is_muted)
    theme_mode = payload.get("themeMode", app_state.theme_mode)

    if not isinstance(bank_tasks, list) or not isinstance(wheel_tasks, list):
        return JsonResponse({"error": "bankTasks and wheelTasks must be arrays."}, status=400)
    if not isinstance(is_muted, bool):
        return JsonResponse({"error": "isMuted must be boolean."}, status=400)
    if theme_mode not in VALID_THEME_MODES:
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
        if not isinstance(item_labels, list) or not all(isinstance(lbl, str) for lbl in item_labels):
            return JsonResponse({"error": "preset itemLabels must be an array of strings."}, status=400)

    app_state.bank_tasks = bank_tasks
    app_state.wheel_tasks = wheel_tasks
    app_state.presets = presets
    app_state.is_muted = is_muted
    app_state.theme_mode = theme_mode
    app_state.save(update_fields=[
        "bank_tasks", "wheel_tasks", "presets",
        "is_muted", "theme_mode", "updated_at",
        "roles_data", "current_role",
    ])

    return JsonResponse({"status": "ok", "state": _serialize_state(app_state)})


@csrf_exempt
@require_http_methods(["POST"])
def set_roles_password(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    password = payload.get("password", "")
    if not isinstance(password, str) or not password.strip():
        return JsonResponse({"error": "password is required."}, status=400)

    app_state, _ = AppState.objects.get_or_create(key="default")
    if app_state.roles_password_hash:
        return JsonResponse({"error": "Password already set. Cannot overwrite."}, status=403)

    app_state.roles_password_hash = _hash_password(password)
    app_state.save(update_fields=["roles_password_hash"])
    return JsonResponse({"status": "ok"})


@csrf_exempt
@require_http_methods(["POST"])
def verify_roles_password(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    password = payload.get("password", "")
    app_state, _ = AppState.objects.get_or_create(key="default")

    if not app_state.roles_password_hash:
        return JsonResponse({"valid": False, "error": "No password set."}, status=400)

    valid = _hash_password(password) == app_state.roles_password_hash
    return JsonResponse({"valid": valid})
