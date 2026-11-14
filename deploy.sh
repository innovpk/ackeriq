#!/usr/bin/env bash
#
# Deploy AckerIQ (NASA Space Apps) to Google Cloud Run.
#
set -euo pipefail

PROJECT="${PROJECT:-ackeriq-nasa}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-ackeriq}"

ACCOUNT_ARGS=()
if [ -n "${ACCOUNT:-}" ]; then
  ACCOUNT_ARGS=(--account "$ACCOUNT")
fi

gcloud run deploy "$SERVICE" \
  --quiet \
  "${ACCOUNT_ARGS[@]}" \
  --project "$PROJECT" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --cpu-throttling \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 60

echo ""
echo "Deployed. Service URL:"
gcloud run services describe "$SERVICE" \
  "${ACCOUNT_ARGS[@]}" \
  --project "$PROJECT" \
  --region "$REGION" \
  --format='value(status.url)'
