#!/usr/bin/env bash
set -euo pipefail
SALON="10000000-0000-0000-0000-000000000001"
psql postgresql://localhost/glamhour_dev -c "UPDATE salon_service_categories SET is_active = false WHERE salon_id = '$SALON';" >/dev/null
echo "Categories disabled. Creating provider..."
curl -s -X POST "http://127.0.0.1:3001/api/salons/$SALON/professionals" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test Disabled Cat","languages":["English"],"status":"active","salonEarningsPercent":40,"professionalEarningsPercent":60,"useSalonSchedule":true,"serviceAssignments":[{"serviceId":"60000000-0000-0000-0000-000000000001","isActive":true,"durationOverrideMinutes":90}]}'
echo
psql postgresql://localhost/glamhour_dev -c "UPDATE salon_service_categories SET is_active = true WHERE salon_id = '$SALON';" >/dev/null
