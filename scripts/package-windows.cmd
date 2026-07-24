@echo off
REM Windows entrypoint for packaging. Run from repo root in cmd.exe or PowerShell.
setlocal
cd /d "%~dp0\.."
bash scripts/package-windows.sh %*
if errorlevel 1 (
  echo.
  echo If bash is unavailable, use Git Bash, or:
  echo   wsl ./scripts/package-windows.sh
  exit /b 1
)
endlocal
