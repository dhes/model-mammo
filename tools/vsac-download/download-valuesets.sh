#!/bin/bash
# Download ValueSets from VSAC for client-side CQL execution
# Requires: VSAC_API_KEY environment variable

set -e

if [ -z "$VSAC_API_KEY" ]; then
  echo "Error: Set VSAC_API_KEY environment variable"
  echo "Get your key from: https://uts.nlm.nih.gov/uts/profile"
  exit 1
fi

OUTPUT_DIR="../../input/valuesets"
mkdir -p "$OUTPUT_DIR"

# ValueSet OIDs used in our CQL
VALUESETS=(
  # Breast Cancer Screening (CMS125)
  "2.16.840.1.113762.1.4.1116.185|Breast Cancer ICD-10"
  "2.16.840.1.113883.3.1444.3.102|Breast Cancer SNOMED"
  "2.16.840.1.113883.3.464.1003.198.12.1068|History of bilateral mastectomy"
  "2.16.840.1.113883.3.464.1003.108.12.1018|Mammography"

  # Cervical Cancer Screening (CMS124)
  "2.16.840.1.113883.3.464.1003.111.12.1016|Congenital or Acquired Absence of Cervix"
  "2.16.840.1.113883.3.464.1003.110.12.1059|HPV Test"
  "2.16.840.1.113883.3.464.1003.198.12.1014|Hysterectomy with No Residual Cervix"
  "2.16.840.1.113883.3.464.1003.108.12.1017|Pap Test"

  # Colorectal Cancer Screening (CMS130)
  "2.16.840.1.113883.3.464.1003.198.12.1011|Fecal Occult Blood Test"
  "2.16.840.1.113883.3.464.1003.108.12.1039|Stool DNA with FIT Test"
  "2.16.840.1.113883.3.464.1003.108.12.1020|Colonoscopy"
  "2.16.840.1.113883.3.464.1003.198.12.1010|Flexible Sigmoidoscopy"
  "2.16.840.1.113883.3.464.1003.108.12.1038|CT Colonography"
  "2.16.840.1.113883.3.464.1003.198.12.1019|Total Colectomy"
  "2.16.840.1.113883.3.464.1003.108.12.1001|Malignant Neoplasm of Colon"
)

echo "Downloading ${#VALUESETS[@]} ValueSets from VSAC..."

for entry in "${VALUESETS[@]}"; do
  OID="${entry%%|*}"
  NAME="${entry##*|}"
  SAFE_NAME=$(echo "$NAME" | tr ' ' '_' | tr -cd '[:alnum:]_')

  echo "  Fetching: $NAME ($OID)"

  # VSAC FHIR API endpoint
  URL="https://cts.nlm.nih.gov/fhir/ValueSet/${OID}/\$expand"

  curl -s -H "Authorization: Basic $(echo -n "apikey:${VSAC_API_KEY}" | base64)" \
       "$URL" \
       -o "${OUTPUT_DIR}/${SAFE_NAME}.json"

  # Check if download succeeded
  if grep -q '"resourceType"' "${OUTPUT_DIR}/${SAFE_NAME}.json" 2>/dev/null; then
    echo "    ✓ Downloaded"
  else
    echo "    ✗ Failed - check API key or OID"
    cat "${OUTPUT_DIR}/${SAFE_NAME}.json"
  fi
done

echo ""
echo "Done. ValueSets saved to: $OUTPUT_DIR"
