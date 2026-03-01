# Spin the Yarin!

A kid-friendly "spin the wheel" game built with **Django** + **React (browser-loaded)**.

This app supports:
- Task bank with add/edit/delete
- Drag-and-drop between task bank and wheel
- Dynamic wheel slices and labels inside slices
- Spin by button or by dragging the wheel
- Needle friction/tension effect near end of spin
- Winner highlight and text-to-speech (Hebrew + English)
- Theme modes: auto, morning, dawn, sunset, night
- Reset wheel (move all wheel tasks back to bank)
- Backend persistence API (`/api/state/`) for save/load

## Tech Stack

- Backend: Django 4.2
- Frontend: React 18 via CDN + Babel (no Node build step required)
- Storage: Django SQLite + browser `localStorage` fallback
- Environment: Conda env `django_learn`

## Project Structure

- `manage.py` - Django entrypoint
- `backend/` - Django project config
- `wheelgame/` - Django app (views, urls)
- `templates/wheelgame/index.html` - page shell
- `static/wheelgame/app.js` - React app logic
- `static/wheelgame/styles.css` - styles/themes

## Prerequisites

- Conda installed
- Conda environment `django_learn` with Python + Django

## Run Locally

From project root:

```powershell
conda run -n django_learn python manage.py migrate
conda run -n django_learn python manage.py runserver 127.0.0.1:8088
```

Open:
- App: `http://127.0.0.1:8088/`
- Health endpoint: `http://127.0.0.1:8088/api/health/`
- State endpoint: `http://127.0.0.1:8088/api/state/`

## Open on iPad / Phone (same Wi-Fi)

1. Start server on all interfaces:

```powershell
conda run -n django_learn python manage.py runserver 0.0.0.0:8088
```

2. Find your computer LAN IP (Windows):

```powershell
ipconfig
```

Look for IPv4 address of your active adapter, for example `192.168.1.35`.

3. On iPad/phone (same Wi-Fi), open:

`http://<YOUR_LAN_IP>:8088/`

Example:

`http://192.168.1.35:8088/`

If it does not open, allow Python/Django through Windows Firewall and make sure both devices are on the same network.

## How To Use

1. Add tasks in the task bank (right pane)
2. Drag tasks from bank into wheel slices
3. Spin with:
   - `Spin` button, or
   - dragging/flinging the wheel
4. Listen to winner announcement
5. Use `Replay Voice` / `Mute Voice` as needed
6. Use `Reset Wheel` to return all wheel tasks back to bank

## Notes

- Hebrew text auto-switches to RTL and Arial-like font.
- Spin interactions temporarily lock editing/dragging for consistency.
- Wheel/task/theme/mute settings persist in backend (`/api/state/`) and localStorage fallback.

## Troubleshooting

- If the page does not update after code changes, hard refresh (`Ctrl+F5`).
- If speech is silent:
  - Check browser audio output
  - Click once on the page first (some browsers require user interaction)
  - Ensure system has voices for `he-IL`/`en-US` installed
- If port `8088` is busy, stop the conflicting process or choose another port.

## Recommended Next Additions

- Basic test suite (Django endpoint tests + key frontend logic tests)
- Export/import tasks as JSON
- PWA mode (installable app experience)
- Optional sound effects and confetti toggle

