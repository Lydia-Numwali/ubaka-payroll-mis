# Ubaka — Windows all-in-one packaging

This document explains how to produce **UbakaSetup-*.exe**, an NSIS installer that
bundles:

- Electron desktop UI
- Node.js backend API
- Portable PostgreSQL
- Fingerprint sidecar (`fingerprint-service.exe`)
- Optional Windows ZKFinger SDK DLLs

## Prerequisites (build machine)

Use a **Windows 10/11 x64** machine (or Windows CI runner):

1. Node.js 20+ (for building; the installer also embeds a Node runtime for the API)
2. Python 3.11+ and `pip` (to build the fingerprint exe)
3. Git Bash or WSL (to run `scripts/package-windows.sh`), **or** `scripts/package-windows.cmd`
4. Zig/Visual C++ build tools only if `bcrypt` needs a native rebuild
5. ZKTeco Live20R **Windows driver** installed on target laptops (not bundled)

## One-time: Windows ZKFinger SDK

1. Obtain the official **ZKFinger SDK for Windows** from ZKTeco.
2. Copy DLLs into [`resources/sdk/windows/`](resources/sdk/windows/), especially `libzkfp.dll`.
3. See [`resources/sdk/windows/README.md`](resources/sdk/windows/README.md).

Without DLLs the installer still builds; the app runs fingerprint in **mock** mode.

## Build fingerprint exe

```bat
cd fingerprint-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt pyinstaller
pyinstaller build_windows.spec
```

Output: `fingerprint-service/dist/fingerprint-service.exe`

## Build the installer

From the repo root (Git Bash):

```bash
chmod +x scripts/package-windows.sh
./scripts/package-windows.sh
```

Or from cmd:

```bat
scripts\package-windows.cmd
```

What the script does:

1. Downloads (into `vendor/`, gitignored):
   - Node Windows x64 zip
   - PostgreSQL Windows x64 binaries (EnterpriseDB zip)
2. Builds backend (`tsc`) and frontend (`vite` + Electron main)
3. Stages sidecars under `staging/`
4. Runs `electron-builder --win nsis`

Installer output: `frontend/release/UbakaSetup-1.0.0.exe` (version from `frontend/package.json`).

### Stage only (no installer)

Useful on Linux while preparing artifacts:

```bash
./scripts/package-windows.sh --stage-only
```

### Force Windows build from Linux (experimental)

```bash
FORCE_WIN_BUILD=1 ./scripts/package-windows.sh
```

Requires Wine and matching Windows native modules; **not recommended**. Prefer a Windows host.

## What happens on first launch

1. Electron starts a splash screen.
2. Portable Postgres initializes under `%APPDATA%\ubaka-attendance\pgdata` (port **54329**).
3. Schema + `001_daily_wage` migration applied once (`.schema_version` stamp).
4. Backend starts on `http://127.0.0.1:5000`.
5. Fingerprint service starts on `http://127.0.0.1:5001` (mock if no `libzkfp.dll`).
6. Main UI opens.

Data survives reinstalls because it lives in AppData.

## Dev vs packaged

| Mode | How |
|------|-----|
| Linux day-to-day | `./start-all.sh` (Vite + tsx backend + Python fingerprint) |
| Electron UI only (dev) | `cd frontend && npm run dev` (`UBAKA_SKIP_SERVICES=1`) |
| Packaged Windows | Install `UbakaSetup-*.exe` and launch **Ubaka Attendance** |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Splash then error about PostgreSQL | Ensure `staging/postgresql/bin/postgres.exe` was present when packaging; re-run package script after vendor download |
| Fingerprint mock warning | Add Windows SDK DLLs to `resources/sdk/windows/` and rebuild, or copy DLLs next to the installed app’s `resources/sdk/windows/` |
| Backend health timeout | Check `%APPDATA%\ubaka-attendance\logs\backend.log` and `postgres.log` |
| Port in use | Bundled Postgres uses **54329**; API **5000**; fingerprint **5001** — free those ports |

## Layout inside the installed app

```
Ubaka Attendance/
  Ubaka Attendance.exe
  resources/
    app.asar          (UI + Electron main)
    backend/          (dist + node_modules + database SQL)
    node/             (node.exe)
    postgresql/       (portable PG)
    fingerprint/      (fingerprint-service.exe)
    sdk/windows/      (optional DLLs)
```
