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

echo Собираю web-версию...
call npm.cmd run build:web
if errorlevel 1 (
  echo Ошибка при сборке web-версии.
  pause
  exit /b 1
)

echo Собираю один автономный HTML...
call npm.cmd run build:single
if errorlevel 1 (
  echo Ошибка при сборке автономного файла.
  pause
  exit /b 1
)

echo Готово: Choir-Standalone.html
start "" "%~dp0Choir-Standalone.html"
exit /b 0
