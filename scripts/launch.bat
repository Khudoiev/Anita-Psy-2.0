@echo off
title Anita · AI Psychologist
echo.
echo   ╔══════════════════════════════════════╗
echo   ║   Anita · AI Психолог               ║
echo   ║   Запуск...                          ║
echo   ╚══════════════════════════════════════╝
echo.
cd /d "%~dp0.."
docker-compose -f docker-compose.yml -f infra/docker-compose.override.yml up -d --build
timeout /t 3 /nobreak > nul
start "" "http://localhost"
echo.
echo   Anita запущена: http://localhost
echo   Для остановки: docker-compose -f docker-compose.yml -f infra/docker-compose.override.yml down
echo.
pause
