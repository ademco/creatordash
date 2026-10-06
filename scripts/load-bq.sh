#!/usr/bin/env bash
# Loads CSV files into the BigQuery tables and checks the live dashboard sees them.
#
#   scripts/load-bq.sh YOUR_PROJECT_ID                 # loads data/sample
#   scripts/load-bq.sh YOUR_PROJECT_ID data/real       # loads your real numbers
#
# Uses gcloud, bq, and Node (no Python), so it works even when the local Python
# install is broken. The files are first checked and cleaned by the same parser
# the API uses (api/src/clean-data.ts): platform names lowercased, spaces
# trimmed, columns put in table order. A problem stops it before any upload,
# naming the line to fix. Each run replaces the table contents, so it is safe
# to run again. It creates nothing: the dataset and tables come from Terraform
# (infra/main.tf). Loading is free; the checks are tiny queries.
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

for tool in gcloud bq curl node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing $tool. gcloud and bq: brew install --cask google-cloud-sdk. node: see .nvmrc." >&2
    exit 1
  fi
done
for file in audience content; do
  if [[ ! -f "$DATA_DIR/$file.csv" ]]; then
    echo "Missing $DATA_DIR/$file.csv" >&2
    exit 1
  fi
done

if [[ ! -x node_modules/.bin/tsx ]]; then
  echo "Run npm install first." >&2
  exit 1
fi

echo "==> 1/5 Checking and cleaning $DATA_DIR"
CLEAN_DIR="$(mktemp -d)"
trap 'rm -rf "$CLEAN_DIR"' EXIT
if ! COUNTS="$(node_modules/.bin/tsx api/src/clean-data.ts "$DATA_DIR" "$CLEAN_DIR")"; then
  echo "Nothing was uploaded. Fix the lines above and run this again." >&2
  exit 1
fi
read -r AUDIENCE_ROWS CONTENT_ROWS <<<"$COUNTS"
echo "    $AUDIENCE_ROWS audience rows and $CONTENT_ROWS content rows look good"

echo "==> 2/5 Checking you are logged in to Google Cloud"
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

echo "==> 3/5 Loading into BigQuery (replaces what is there)"
# The cleaned copies are loaded, not the originals. --skip_leading_rows=1 skips
# the header line. --allow_quoted_newlines lets a quoted title contain a line
# break; quoted commas work without any flag.
for table in audience content; do
  "${BQ[@]}" load --replace --source_format=CSV --skip_leading_rows=1 --allow_quoted_newlines \
    "$PROJECT_ID:$DATASET.$table" "$CLEAN_DIR/$table.csv" >/dev/null
  echo "    Loaded $table"
done

echo "==> 4/5 Counting rows"
for table in audience content; do
  if [[ "$table" == audience ]]; then expected="$AUDIENCE_ROWS"; else expected="$CONTENT_ROWS"; fi
  actual="$("${BQ[@]}" query --quiet --use_legacy_sql=false --format=csv \
    "SELECT COUNT(*) FROM \`$PROJECT_ID.$DATASET.$table\`" | tail -1)"
  if [[ "$actual" == "$expected" ]]; then
    echo "    $table: $actual rows, matches the file"
  else
    echo "    $table: $actual rows in BigQuery but $expected in the file. Run this again." >&2
  fi
done

echo "==> 5/5 Asking the live dashboard"
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
