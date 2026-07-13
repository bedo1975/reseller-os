#!/bin/bash
# Generate a fresh zip of the project source code
set -e

cd /home/z/my-project

ZIP_FILE="public/reseller-os.zip"

# Remove old zip
rm -f "$ZIP_FILE"

# Create a fresh zip excluding heavy/unnecessary folders
# Using git archive if available, otherwise manual zip
if command -v zip &> /dev/null; then
  echo "Creating zip with manual exclusion list..."
  zip -r "$ZIP_FILE" . \
    -x ".next/*" \
    -x "node_modules/*" \
    -x "node_modules/.cache/*" \
    -x ".git/*" \
    -x "db/*.db" \
    -x "db/*.db-journal" \
    -x "public/uploads/*" \
    -x "public/reseller-os.zip" \
    -x "download/*" \
    -x "scripts/*.log" \
    -x "*.log" \
    -x ".DS_Store" \
    -x "Thumbs.db" \
    -x "agent-ctx/*" \
    -x "skills/*" \
    -x "examples/*" \
    -x "upload/*" \
    -x "check-db.js" \
    2>&1 | tail -5

  echo ""
  echo "=== Zip created ==="
  ls -lh "$ZIP_FILE"
else
  echo "zip command not found, using Node archiver..."
  node scripts/make-zip.js
fi

echo ""
echo "=== Verify zip contains new features ==="
unzip -l "$ZIP_FILE" | grep -E "hours-editor|paiement-securise|livraison-rapide|retours-14-jours|logo-upload" | head -10
echo ""
echo "=== Verify schema in zip has new fields ==="
unzip -p "$ZIP_FILE" prisma/schema.prisma | grep -cE "hoursVisible|logoImage|trustPagePaymentTitle"
echo "(should be > 0)"
