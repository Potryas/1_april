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

echo Собираю оптимизированную web-версию...
call npm.cmd run build:web
if errorlevel 1 (
  echo Сборка завершилась с ошибкой.
  pause
  exit /b 1
)

echo Запускаю локальный сервер для папки docs...
start "Choir Web Server" cmd /k "cd /d ""%~dp0"" && set SERVE_ROOT=docs && node server.js"

timeout /t 2 /nobreak >nul

echo Открываю web-версию в браузере...
start "" "http://localhost:4173"

exit /b 0
