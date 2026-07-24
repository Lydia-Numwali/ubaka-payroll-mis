#!/usr/bin/env bash
# Stage Windows runtime sidecars and (on Windows) build the NSIS installer.
#
# Usage (from repo root, preferably on Windows Git Bash / CI):
#   ./scripts/package-windows.sh           # stage + electron-builder
#   ./scripts/package-windows.sh --stage-only
#
# Downloads (cached under vendor/):
#   - Node.js Windows x64 binary distribution
#   - PostgreSQL Windows x64 binaries (EDB zip)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor"
STAGING="$ROOT/staging"
NODE_VERSION="${NODE_VERSION:-22.14.0}"
# EnterpriseDB provides convenient Windows zip builds of PostgreSQL
PG_VERSION="${PG_VERSION:-16.6-1}"
PG_EDB_URL="${PG_EDB_URL:-https://get.enterprisedb.com/postgresql/postgresql-${PG_VERSION}-windows-x64-binaries.zip}"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip"

STAGE_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --stage-only) STAGE_ONLY=1 ;;
  esac
done

echo "==> Ubaka Windows packaging"
echo "    Root: $ROOT"

mkdir -p "$VENDOR" "$STAGING"

download_zip() {
  local url="$1"
  local dest_dir="$2"
  local marker="$3"
  if [[ -f "$dest_dir/$marker" ]]; then
    echo "    Already present: $dest_dir"
    return 0
  fi
  local tmp
  tmp="$(mktemp -d)"
  echo "    Downloading $url"
  if command -v curl >/dev/null 2>&1; then
    curl -L --fail --retry 3 -o "$tmp/pkg.zip" "$url"
  else
    wget -O "$tmp/pkg.zip" "$url"
  fi
  mkdir -p "$dest_dir"
  unzip -q "$tmp/pkg.zip" -d "$tmp/out"
  # Flatten single top-level folder if present
  local top
  top="$(find "$tmp/out" -mindepth 1 -maxdepth 1 -type d | head -1 || true)"
  if [[ -n "$top" ]] && [[ "$(find "$tmp/out" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1 ]]; then
    cp -a "$top"/. "$dest_dir"/
  else
    cp -a "$tmp/out"/. "$dest_dir"/
  fi
  rm -rf "$tmp"
}

echo "==> Ensuring vendor/node-win (Node v${NODE_VERSION})"
download_zip "$NODE_URL" "$VENDOR/node-win" "node.exe"

echo "==> Ensuring vendor/postgresql-win (PostgreSQL ${PG_VERSION})"
# EDB zip extracts to pgsql/
if [[ ! -f "$VENDOR/postgresql-win/bin/postgres.exe" && ! -f "$VENDOR/postgresql-win/pgsql/bin/postgres.exe" ]]; then
  download_zip "$PG_EDB_URL" "$VENDOR/postgresql-win" "bin/postgres.exe" || true
  if [[ -f "$VENDOR/postgresql-win/pgsql/bin/postgres.exe" ]]; then
    # Normalize to vendor/postgresql-win/bin/...
    shopt -s dotglob
    mkdir -p "$VENDOR/postgresql-win-normalized"
    mv "$VENDOR/postgresql-win/pgsql"/* "$VENDOR/postgresql-win-normalized/" 2>/dev/null || \
      cp -a "$VENDOR/postgresql-win/pgsql"/. "$VENDOR/postgresql-win-normalized/"
    rm -rf "$VENDOR/postgresql-win"
    mv "$VENDOR/postgresql-win-normalized" "$VENDOR/postgresql-win"
    shopt -u dotglob
  fi
fi

if [[ ! -f "$VENDOR/postgresql-win/bin/postgres.exe" ]]; then
  echo "WARNING: PostgreSQL Windows binaries not found at vendor/postgresql-win/bin/postgres.exe"
  echo "         Download manually from EnterpriseDB and extract so that bin/postgres.exe exists."
  echo "         URL: $PG_EDB_URL"
fi

echo "==> Building backend"
(
  cd "$ROOT/backend"
  npm install --legacy-peer-deps
  npm run build
)

echo "==> Building frontend (renderer + electron main)"
(
  cd "$ROOT/frontend"
  npm install --legacy-peer-deps
  npm run build
)

echo "==> Staging sidecars into staging/"
rm -rf "$STAGING"
mkdir -p \
  "$STAGING/backend" \
  "$STAGING/postgresql" \
  "$STAGING/node" \
  "$STAGING/fingerprint" \
  "$STAGING/sdk/windows"

# Backend: compiled JS + production node_modules + SQL
cp -a "$ROOT/backend/dist" "$STAGING/backend/dist"
cp -a "$ROOT/backend/package.json" "$STAGING/backend/package.json"
cp -a "$ROOT/backend/database" "$STAGING/backend/database"
(
  cd "$STAGING/backend"
  # Install production deps into staging (run on Windows so native modules match).
  npm install --omit=dev --legacy-peer-deps --ignore-scripts
  case "$(uname -s 2>/dev/null || echo unknown)" in
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      npm rebuild bcrypt --build-from-source || true
      ;;
  esac
)

# Node runtime
if [[ -d "$VENDOR/node-win" ]]; then
  cp -a "$VENDOR/node-win"/. "$STAGING/node/"
fi

# PostgreSQL
if [[ -d "$VENDOR/postgresql-win" ]]; then
  cp -a "$VENDOR/postgresql-win"/. "$STAGING/postgresql/"
fi

# Fingerprint: prefer prebuilt exe, else copy Python sources for PyInstaller later
if [[ -f "$ROOT/fingerprint-service/dist/fingerprint-service.exe" ]]; then
  cp -a "$ROOT/fingerprint-service/dist/fingerprint-service.exe" "$STAGING/fingerprint/"
elif [[ -f "$VENDOR/fingerprint-service.exe" ]]; then
  cp -a "$VENDOR/fingerprint-service.exe" "$STAGING/fingerprint/fingerprint-service.exe"
else
  echo "    No fingerprint-service.exe yet — staging Python sources + placeholder note"
  cp -a "$ROOT/fingerprint-service/"*.py "$STAGING/fingerprint/" 2>/dev/null || true
  cp -a "$ROOT/fingerprint-service/requirements.txt" "$STAGING/fingerprint/" 2>/dev/null || true
  cat > "$STAGING/fingerprint/README.txt" <<'EOF'
Build fingerprint-service.exe on Windows:
  pip install pyinstaller -r requirements.txt
  pyinstaller build_windows.spec
Then re-run scripts/package-windows.sh
EOF
fi

# Windows ZKFinger SDK (manual drop-in)
mkdir -p "$ROOT/resources/sdk/windows"
if [[ -d "$ROOT/resources/sdk/windows" ]]; then
  cp -a "$ROOT/resources/sdk/windows"/. "$STAGING/sdk/windows/" 2>/dev/null || true
fi
# Keep a marker so the folder exists in the installer even without DLLs
touch "$STAGING/sdk/windows/.gitkeep"

echo "==> Staging complete: $STAGING"

if [[ "$STAGE_ONLY" -eq 1 ]]; then
  echo "Done (--stage-only)."
  exit 0
fi

echo "==> Running electron-builder (Windows NSIS)"
UNAME_S="$(uname -s 2>/dev/null || echo unknown)"
IS_WINDOWS=0
case "$UNAME_S" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT) IS_WINDOWS=1 ;;
esac

if [[ "$IS_WINDOWS" -ne 1 && -z "${FORCE_WIN_BUILD:-}" ]]; then
  echo "NOTE: You are not on Windows. electron-builder --win may fail or need Wine."
  echo "      Set FORCE_WIN_BUILD=1 to try anyway, or run this script on a Windows machine."
  echo "Staging finished. Skipping installer build on this host."
  exit 0
fi

(
  cd "$ROOT/frontend"
  npx electron-builder --win --x64 --config electron-builder.yml
)

echo "==> Installer output under frontend/release/"
ls -la "$ROOT/frontend/release" 2>/dev/null || true
