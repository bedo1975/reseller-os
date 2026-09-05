#!/bin/bash
# Create a real .zip file with the full Reseller OS source code.
# Excludes node_modules, .next, .git, build artifacts, and dev-only files.

set -e

PROJECT_DIR="/home/z/my-project"
OUTPUT_ZIP="/home/z/my-project/download/reseller-os.zip"
STAGING_DIR="/tmp/reseller-os-staging"

cd "$PROJECT_DIR"

# Clean previous staging
rm -rf "$STAGING_DIR"
rm -f "$OUTPUT_ZIP"

mkdir -p "$STAGING_DIR/reseller-os"

# Copy project files (excluding heavy/build directories via a tmp-exclude list)
cat > /tmp/zip-exclude.lst <<'EOF'
node_modules/
.next/
.git/
.zscripts/logs/
agent-ctx/
data/uploads/
download/
scripts/start-dev.sh
tool-results/
upload/
*.log
.DS_Store
EOF

# Use rsync to copy the project to staging while excluding heavy dirs
rsync -a \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.zscripts/logs' \
  --exclude='.zscripts/mini-service-*.log' \
  --exclude='.zscripts/dev.pid' \
  --exclude='agent-ctx' \
  --exclude='data/uploads' \
  --exclude='download' \
  --exclude='tool-results' \
  --exclude='upload' \
  --exclude='skills' \
  --exclude='examples' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='worklog.md' \
  --exclude='db/custom.db-journal' \
  --exclude='db/custom.db-wal' \
  --exclude='db/custom.db-shm' \
  ./ "$STAGING_DIR/reseller-os/"

# Verify the staging dir has the source files
echo "=== Staging directory contents ==="
ls -la "$STAGING_DIR/reseller-os/" | head -30

echo ""
echo "=== File count ==="
find "$STAGING_DIR/reseller-os" -type f | wc -l

echo ""
echo "=== Total size ==="
du -sh "$STAGING_DIR/reseller-os"

# Create a real .zip file (not a tar.gz)
cd "$STAGING_DIR"
zip -r -q "$OUTPUT_ZIP" reseller-os/

echo ""
echo "=== Zip created ==="
ls -lh "$OUTPUT_ZIP"
file "$OUTPUT_ZIP"

echo ""
echo "=== Zip contents (first 40 entries) ==="
unzip -l "$OUTPUT_ZIP" | head -40
echo "..."
unzip -l "$OUTPUT_ZIP" | tail -5

# Clean staging
rm -rf "$STAGING_DIR" /tmp/zip-exclude.lst

echo ""
echo "✅ Done"
