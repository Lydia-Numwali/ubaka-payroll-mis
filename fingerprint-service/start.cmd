@echo off
REM Start fingerprint service on Windows (dev). Prefer the packaged .exe in production.
setlocal
cd /d "%~dp0"

if exist "%~dp0..\resources\sdk\windows\libzkfp.dll" (
  set "ZKFP_LIB_DIR=%~dp0..\resources\sdk\windows"
  set "PATH=%ZKFP_LIB_DIR%;%PATH%"
  set "ALLOW_MOCK=0"
) else (
  echo WARNING: libzkfp.dll not found — starting with ALLOW_MOCK=1
  set "ALLOW_MOCK=1"
)

if exist "dist\fingerprint-service.exe" (
  dist\fingerprint-service.exe
) else (
  python zkfinger_service.py
)
endlocal
