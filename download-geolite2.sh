#!/bin/bash
# Download MaxMind GeoLite2-City database (free, no license key needed for the legacy tarball)
# This script downloads the .mmdb file used by the maxmind npm package for IP geolocation.
set -e

DEST_DIR="/home/z/my-project/data"
DEST_FILE="${DEST_DIR}/GeoLite2-City.mmdb"
TMP_DIR="/tmp/geolite2-download"

mkdir -p "$DEST_DIR"
mkdir -p "$TMP_DIR"

# Check if the file already exists and is younger than 30 days
if [ -f "$DEST_FILE" ]; then
  AGE_DAYS=$(( ( $(date +%s) - $(stat -c %Y "$DEST_FILE") ) / 86400 ))
  if [ "$AGE_DAYS" -lt 30 ]; then
    echo "✓ GeoLite2-City.mmdb already exists (${AGE_DAYS} days old, < 30 days threshold)"
    echo "  Path: $DEST_FILE"
    exit 0
  fi
  echo "→ GeoLite2-City.mmdb is ${AGE_DAYS} days old, refreshing..."
fi

# Try multiple sources for the GeoLite2-City database
SOURCES=(
  "https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb"
  "https://git.io/GeoLite2-City.mmdb"
)

echo "↓ Downloading GeoLite2-City.mmdb..."

for URL in "${SOURCES[@]}"; do
  echo "  Trying: $URL"
  if curl -fsSL -o "$DEST_FILE" "$URL" 2>/dev/null; then
    # Verify the file is a valid mmdb (check magic bytes)
    FILE_TYPE=$(file -b "$DEST_FILE" 2>/dev/null || echo "")
    FILE_SIZE=$(stat -c %s "$DEST_FILE" 2>/dev/null || echo "0")
    if [ "$FILE_SIZE" -gt 1000000 ]; then
      echo "✓ Downloaded successfully (${FILE_SIZE} bytes)"
      echo "  Path: $DEST_FILE"
      exit 0
    fi
    echo "  File too small or invalid (${FILE_SIZE} bytes), trying next source..."
    rm -f "$DEST_FILE"
  else
    echo "  Download failed, trying next source..."
  fi
done

echo "✗ Failed to download GeoLite2-City.mmdb from all sources."
echo "  You can manually download it from:"
echo "  https://github.com/P3TERX/GeoLite.mmdb/releases/latest"
echo "  And place it at: $DEST_FILE"
exit 1
