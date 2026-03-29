@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден.
  echo Установи Node.js, затем запусти этот файл снова.
  pause
  exit /b 1
)

echo Запускаю локальный сервер...
start "Choir Server" cmd /k "cd /d ""%~dp0"" && node server.js"

timeout /t 2 /nobreak >nul

echo Открываю игру в браузере...
start "" "http://localhost:4173"

exit /b 0
