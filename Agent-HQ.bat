@echo off
title Agent HQ
cd /d "%~dp0"

echo ====================================================
echo             STARTING AGENT HQ...
echo ====================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

node scripts\launcher.js
pause
