#!/bin/bash

# ZKTeco Fingerprint Service Startup Script

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/venv-fingerprint"
SDK_LIB_DIR="$PROJECT_ROOT/resources/sdk/SDK/lib-x64"

echo "======================================"
echo "ZKTeco Fingerprint Service"
echo "======================================"

# Activate or create virtual environment
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    pip install --upgrade pip -q
    pip install -r "$SCRIPT_DIR/requirements.txt" -q
else
    source "$VENV_DIR/bin/activate"
fi

# Ensure deps are installed
if ! python -c "import flask" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r "$SCRIPT_DIR/requirements.txt" -q
fi

# ---------------------------------------------------------------------------
# Native ZKFinger SDK libraries (required for real Live20R hardware)
# ---------------------------------------------------------------------------
if [ ! -f "$SDK_LIB_DIR/libzkfp.so" ]; then
    echo "ERROR: Native ZKFinger SDK not found at:"
    echo "  $SDK_LIB_DIR/libzkfp.so"
    echo "Install the ZKFinger SDK for Linux into resources/sdk/"
    if [ "${ALLOW_MOCK:-0}" != "1" ]; then
        exit 1
    fi
    echo "ALLOW_MOCK=1 set — continuing without hardware libraries"
else
    export LD_LIBRARY_PATH="$SDK_LIB_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    echo "Native SDK libs: $SDK_LIB_DIR"

    # Keep pyzkfp's dll/ folder in sync so .NET Core can resolve libzkfp.dll.so
    PYZKFP_DLL="$VENV_DIR/lib/python3.11/site-packages/pyzkfp/dll"
    if [ -d "$PYZKFP_DLL" ]; then
        cp -n "$SDK_LIB_DIR"/*.so* "$PYZKFP_DLL/" 2>/dev/null || true
        cp -f "$SDK_LIB_DIR/libzkfp.so" "$PYZKFP_DLL/libzkfp.dll.so"
    fi
fi

# ---------------------------------------------------------------------------
# Runtime selection for pythonnet / pyzkfp
#
# Preference order:
#   1. .NET Core (dotnet-runtime) — modern, available in Ubuntu repos
#   2. Mono                       — legacy, requires libmonosgen-2.0.so
# ---------------------------------------------------------------------------
if command -v dotnet &>/dev/null; then
    echo "Using .NET Core runtime for pyzkfp"
    export PYTHONNET_RUNTIME=coreclr
    DOTNET_ROOT=$(dirname "$(realpath "$(which dotnet)")")
    export DOTNET_ROOT
elif ldconfig -p 2>/dev/null | grep -q libmonosgen; then
    echo "Using Mono runtime for pyzkfp"
    export PYTHONNET_RUNTIME=mono
else
    echo "WARNING: No .NET runtime found."
    echo "  To enable hardware: sudo apt-get install dotnet-runtime-10.0"
    if [ "${ALLOW_MOCK:-0}" != "1" ]; then
        exit 1
    fi
fi

# Refuse silent mock unless explicitly allowed
export ALLOW_MOCK="${ALLOW_MOCK:-0}"

echo ""
echo "Starting fingerprint service on port 5001..."
echo ""

python "$SCRIPT_DIR/zkfinger_service.py"
