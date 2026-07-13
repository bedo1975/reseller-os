#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=256"
export PORT=3000
while true; do
  echo "[$(date)] Starting server..."
  node .next/standalone/server.js >> /tmp/next-prod.log 2>&1
  echo "[$(date)] Server exited (code $?), restarting in 2s..."
  sleep 2
done
