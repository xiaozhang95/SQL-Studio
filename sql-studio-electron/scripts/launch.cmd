@echo off
rem Fallback launcher: starts SQL Studio with the Chromium sandbox disabled.
rem Needed on machines where Chromium sandbox init fails (STATUS_BREAKPOINT).
cd /d "%~dp0"
if not exist "SQL Studio.exe" (
  echo Cannot find "SQL Studio.exe" next to this script.
  pause
  exit /b 1
)
start "" "SQL Studio.exe" --no-sandbox
