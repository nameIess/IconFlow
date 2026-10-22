@echo off
title IconFlow
REM ────────────────────────────────────────
REM  IconFlow — One-click macOS icon downloader
REM  Double-click this file to start!
REM ────────────────────────────────────────

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [ERROR] Node.js is not installed or not in PATH.
  echo  Please install Node.js 18+ from https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo  Installing dependencies...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to install dependencies.
    pause
    exit /b 1
  )
)

echo.
echo  Starting IconFlow...
echo.
node src\server.js
if errorlevel 1 (
  echo.
  echo  [ERROR] Server exited with an error.
  pause
  exit /b 1
)
