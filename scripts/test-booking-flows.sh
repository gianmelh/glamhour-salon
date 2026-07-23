#!/usr/bin/env bash
set -euo pipefail

API="http://127.0.0.1:3001/api"
SALON="10000000-0000-0000-0000-000000000001"
CLIENT="40000000-0000-0000-0000-000000000007"
PRO_NAILS="30000000-0000-0000-0000-000000000001"
PRO_LASHES="30000000-0000-0000-0000-000000000002"
PRO_COSMO="30000000-0000-0000-0000-000000000003"
SERVICE_NAILS="60000000-0000-0000-0000-000000000001"
SERVICE_LASHES="60000000-0000-0000-0000-000000000004"
SERVICE_COSMO="60000000-0000-0000-0000-000000000006"
SERVICE_MICRO="60000000-0000-0000-0000-000000000008"
TINY_PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
SIG="10,10 20,20 30,15"

pass=0
fail=0

check() {
  local label="$1"
  local expr="$2"
  if eval "$expr"; then
    echo "PASS: $label"
    pass=$((pass + 1))
  else
    echo "FAIL: $label"
    fail=$((fail + 1))
  fi
}

upload_photo() {
  local category="$1"
  curl -s -X POST "$API/salons/$SALON/treatment-media/upload" \
    -H "Content-Type: application/json" \
    -d "{\"dataBase64\":\"$TINY_PNG\",\"mimeType\":\"image/png\",\"originalFilename\":\"test.png\",\"mediaType\":\"reference\",\"category\":\"$category\"}"
}

create_appointment() {
  local name="$1"
  local professional="$2"
  local service="$3"
  local category="$4"
  local details="$5"
  local starts="$6"
  local ends="$7"

  local upload_json
  upload_json=$(upload_photo "$category")
  local storage_key url
  storage_key=$(echo "$upload_json" | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d["storageKey"])')
  url=$(echo "$upload_json" | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d["url"])')

  local payload
  payload=$(cat <<EOF
{
  "clientId": "$CLIENT",
  "professionalId": "$professional",
  "serviceIds": ["$service"],
  "startsAt": "$starts",
  "endsAt": "$ends",
  "source": "internal",
  "treatmentDetails": $details,
  "treatmentNotes": "$name E2E note"
}
EOF
)

  local create_json
  create_json=$(curl -s -X POST "$API/salons/$SALON/appointments" -H "Content-Type: application/json" -d "$payload")
  local appt_id
  appt_id=$(echo "$create_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')

  local get_json
  get_json=$(curl -s "$API/salons/$SALON/appointments/$appt_id")

  echo "$get_json" | python3 - <<PY
import json, sys
data = json.load(sys.stdin)["data"]
checks = {
  "treatment_details": bool(data.get("treatment_details_by_category")),
  "health_answers": bool(data.get("health_questionnaire_answers")),
  "signatures": len(data.get("clinical_signatures") or []) >= 2,
  "consents": len(data.get("clinical_consents") or []) >= 1,
  "media": len(data.get("clinical_media") or []) >= 1,
}
for key, ok in checks.items():
  print(f"{'PASS' if ok else 'FAIL'}: $name -> {key}")
PY

  local media_url
  media_url=$(echo "$get_json" | python3 -c 'import json,sys; m=json.load(sys.stdin)["data"].get("clinical_media") or []; print(m[0]["url"] if m else "")')
  if [ -n "$media_url" ]; then
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" "$media_url")
    check "$name media URL reachable ($status)" "[ \"$status\" = \"200\" ]"
  else
    check "$name media URL present" "false"
  fi

  echo "$appt_id"
}

echo "=== Service materials endpoint ==="
materials=$(curl -s "$API/salons/$SALON/service-materials?categoryCode=nails&serviceId=$SERVICE_NAILS")
check "service-materials returns array" "echo '$materials' | python3 -c 'import json,sys; d=json.load(sys.stdin); exit(0 if isinstance(d.get(\"data\"), list) else 1)'"

echo "=== Booking flows ==="

NAILS_DETAILS='{
  "category": "nails",
  "nailServiceType": "Full set",
  "nailType": "Almond",
  "handMode": "finger",
  "materialIds": ["fallback-polygel"],
  "materialLabels": ["Polygel"],
  "materials": ["Polygel"],
  "healthAnswers": {"chemical_allergies": "no", "diabetic": "no"},
  "consentAccepted": true,
  "photoConsent": true,
  "professionalSignature": "'"$SIG"'",
  "clientSignature": "'"$SIG"'",
  "signatures": [
    {"type": "professional_signature", "signerName": "Pro", "data": "'"$SIG"'"},
    {"type": "client_signature", "signerName": "Client", "data": "'"$SIG"'"}
  ],
  "consents": [{"type": "appointment_consent", "text": "Consent text", "accepted": true, "version": 1}],
  "rightHand": {"thumb": {"widthMm": "10", "lengthMm": "12"}},
  "mediaItems": []
}'

LASHES_DETAILS='{
  "category": "lashes",
  "style": "Cat Eye",
  "volume": "3D",
  "curl": "C",
  "thickness": "0.15",
  "defaultLength": "12",
  "lashMap": {"rightEye": [{"position": 1, "length": 10}]},
  "healthAnswers": {"adhesive_allergies": "no"},
  "consentAccepted": true,
  "photoConsent": true,
  "professionalSignature": "'"$SIG"'",
  "clientSignature": "'"$SIG"'",
  "signatures": [
    {"type": "professional_signature", "signerName": "Pro", "data": "'"$SIG"'"},
    {"type": "client_signature", "signerName": "Client", "data": "'"$SIG"'"}
  ],
  "consents": [{"type": "appointment_consent", "text": "Consent text", "accepted": true, "version": 1}],
  "mediaItems": []
}'

COSMO_DETAILS='{
  "category": "cosmetology",
  "phototype": "Type III",
  "skin_type": "Combination",
  "equipment": ["Dermapen"],
  "faceAnnotations": [{"x": 50, "y": 40, "type": "Active acne"}],
  "products": "Vitamin C serum",
  "aftercare": "SPF daily",
  "healthAnswers": {"active_acne": "no"},
  "consentAccepted": true,
  "photoConsent": true,
  "professionalSignature": "'"$SIG"'",
  "clientSignature": "'"$SIG"'",
  "signatures": [
    {"type": "professional_signature", "signerName": "Pro", "data": "'"$SIG"'"},
    {"type": "client_signature", "signerName": "Client", "data": "'"$SIG"'"}
  ],
  "consents": [{"type": "appointment_consent", "text": "Consent text", "accepted": true, "version": 1}],
  "mediaItems": []
}'

MICRO_DETAILS='{
  "category": "micropigmentation",
  "area": "Eyebrows",
  "procedure": "Microblading",
  "brow_width_mm": "45",
  "undertone": "Warm",
  "pigment_brand": "Permablend",
  "needle": "18U",
  "touch_up_date": "2026-08-01",
  "clientDesignSignature": "'"$SIG"'",
  "healthAnswers": {"blood_disorders": "no"},
  "consentAccepted": true,
  "photoConsent": true,
  "professionalSignature": "'"$SIG"'",
  "clientSignature": "'"$SIG"'",
  "signatures": [
    {"type": "professional_signature", "signerName": "Pro", "data": "'"$SIG"'"},
    {"type": "client_signature", "signerName": "Client", "data": "'"$SIG"'"},
    {"type": "design_approval", "signerName": "Client", "data": "'"$SIG"'"}
  ],
  "consents": [{"type": "appointment_consent", "text": "Consent text", "accepted": true, "version": 1}],
  "mediaItems": []
}'

create_appointment "Nails" "$PRO_NAILS" "$SERVICE_NAILS" "nails" "$NAILS_DETAILS" "2026-07-25T10:00:00-04:00" "2026-07-25T11:30:00-04:00" >/dev/null
create_appointment "Lashes" "$PRO_LASHES" "$SERVICE_LASHES" "lashes" "$LASHES_DETAILS" "2026-07-25T12:00:00-04:00" "2026-07-25T13:30:00-04:00" >/dev/null
create_appointment "Cosmetology" "$PRO_COSMO" "$SERVICE_COSMO" "cosmetology" "$COSMO_DETAILS" "2026-07-25T14:00:00-04:00" "2026-07-25T15:00:00-04:00" >/dev/null
create_appointment "Micropigmentation" "$PRO_LASHES" "$SERVICE_MICRO" "micropigmentation" "$MICRO_DETAILS" "2026-07-25T16:00:00-04:00" "2026-07-25T18:00:00-04:00" >/dev/null

echo "=== Summary: $pass passed, $fail failed ==="
[ "$fail" -eq 0 ]
