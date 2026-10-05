#!/usr/bin/env bash
# Loads CSV files into the BigQuery tables and checks the live dashboard sees them.
#
#   scripts/load-bq.sh YOUR_PROJECT_ID                 # loads data/sample
#   scripts/load-bq.sh YOUR_PROJECT_ID data/real       # loads your real numbers
#
# Uses only the gcloud and bq command-line tools (no Python), so it works even
# when the local Python install is broken. Each run replaces the table contents,
# so it is safe to run again. It creates nothing: the dataset and tables come
# from Terraform (infra/main.tf). Loading is free; the checks are tiny queries.
set -euo pipefail

PROJECT_ID="${1:-${PROJECT_ID:-}}"
DATA_DIR="${2:-data/sample}"
REGION="${REGION:-us-central1}"
DATASET="${DATASET:-fan_insights}"
LOCATION="${LOCATION:-US}"
SERVICE="${SERVICE:-fan-insights}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: scripts/load-bq.sh YOUR_PROJECT_ID [DATA_DIR]" >&2
  exit 2
fi

cd "$(dirname "$0")/.."

for tool in gcloud bq curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing $tool. Install the Google Cloud CLI: brew install --cask google-cloud-sdk" >&2
    exit 1
  fi
done
for file in audience content; do
  if [[ ! -f "$DATA_DIR/$file.csv" ]]; then
    echo "Missing $DATA_DIR/$file.csv" >&2
    exit 1
  fi
done

echo "==> 1/4 Checking you are logged in to Google Cloud"
ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1)"
if [[ -z "$ACCOUNT" ]]; then
  echo "Not logged in. Run this, then run this script again:" >&2
  echo "  gcloud auth login" >&2
  exit 1
fi
echo "    Logged in as $ACCOUNT"
gcloud config set project "$PROJECT_ID" --quiet >/dev/null 2>&1
echo "    Project set to $PROJECT_ID"

BQ=(bq --project_id="$PROJECT_ID" --location="$LOCATION")

echo "==> 2/4 Loading $DATA_DIR into BigQuery (replaces what is there)"
# --skip_leading_rows=1 skips the header line. --allow_quoted_newlines lets a
# quoted title contain a line break; quoted commas work without any flag.
for table in audience content; do
  "${BQ[@]}" load --replace --source_format=CSV --skip_leading_rows=1 --allow_quoted_newlines \
    "$PROJECT_ID:$DATASET.$table" "$DATA_DIR/$table.csv" >/dev/null
  echo "    Loaded $table"
done

echo "==> 3/4 Counting rows"
for table in audience content; do
  # Lines minus the header. Only off if a title has a line break in it.
  expected=$(($(wc -l <"$DATA_DIR/$table.csv") - 1))
  actual="$("${BQ[@]}" query --quiet --use_legacy_sql=false --format=csv \
    "SELECT COUNT(*) FROM \`$PROJECT_ID.$DATASET.$table\`" | tail -1)"
  if [[ "$actual" == "$expected" ]]; then
    echo "    $table: $actual rows, matches the file"
  else
    echo "    $table: $actual rows in BigQuery, $expected lines in the file. Check the file." >&2
  fi
done

echo "==> 4/4 Asking the live dashboard"
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
QUERY='{"query":"{ overview(days: 90) { combinedAudience gained topPlatform } }"}'
# The API remembers answers for 5 minutes, so it may still hold the old
# "empty" answer. Retry every 30 seconds for up to 6 minutes.
for attempt in $(seq 1 12); do
  response="$(curl -s -m 30 "$URL/graphql" -H 'content-type: application/json' -d "$QUERY" || true)"
  if [[ "$response" == *'"errors"'* || -z "$response" ]]; then
    echo "    The API returned an error: ${response:-no response}" >&2
    echo "    See what went wrong with:" >&2
    echo "      gcloud run services logs read $SERVICE --region $REGION --limit 30" >&2
    exit 1
  fi
  if [[ "$response" != *'"combinedAudience":0'* ]]; then
    echo "    $response"
    echo
    echo "Done. Open $URL/?days=90"
    exit 0
  fi
  echo "    Still showing the old, empty answer (attempt $attempt of 12). Waiting 30 seconds..."
  sleep 30
done

echo "The API still shows no data after 6 minutes. Check the logs:" >&2
echo "  gcloud run services logs read $SERVICE --region $REGION --limit 30" >&2
exit 1
