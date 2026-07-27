@echo off
title Game Arcade
echo.
echo   Starting Game Arcade...
echo.
cd /d "%~dp0"
start "" http://localhost:3000
node server.js
