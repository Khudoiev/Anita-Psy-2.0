@echo off
title Anita · AI Psychologist
echo.
echo   ╔══════════════════════════════════════╗
echo   ║   Anita · AI Психолог               ║
echo   ║   Запуск...                          ║
echo   ╚══════════════════════════════════════╝
echo.
cd /d "%~dp0"
docker-compose up -d --build
timeout /t 3 /nobreak > nul
start "" "http://localhost:3000"
echo.
echo   Anita запущена: http://localhost:3000
echo   Для остановки: docker-compose down
echo.
pause
