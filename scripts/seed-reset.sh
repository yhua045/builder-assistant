#!/bin/bash
set -e

echo "[seed:reset] Stopping any running Metro bundler..."
pkill -f "react-native start" 2>/dev/null || true
sleep 1

echo "[seed:reset] Starting Metro with APP_ENV=reset and cleared cache..."
export APP_ENV=reset
npx react-native start --reset-cache &
METRO_PID=$!

echo "[seed:reset] Waiting for Metro to be ready..."
sleep 10

echo "[seed:reset] Launching app on iPhone 15 Pro..."
npx react-native run-ios --simulator='iPhone 15 Pro'
