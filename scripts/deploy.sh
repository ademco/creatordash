#!/usr/bin/env bash
# Deploys Fan Insights to Google Cloud: creates the infrastructure with
# Terraform, builds and pushes the container image, and starts it on Cloud Run.
#
#   scripts/deploy.sh YOUR_PROJECT_ID
#   SAMPLE_DATA=false scripts/deploy.sh YOUR_PROJECT_ID   # after loading real numbers
#
# Safe to run again for every new version. Terraform shows its plan and
# waits for you to type "yes" before changing anything. Read docs/DEPLOY.md
# first: it covers the one-time setup (project, billing, budget alert).
set -euo pipefail

PROJECT_ID="${1:-${PROJECT_ID:-}}"
REGION="${REGION:-us-central1}"
SAMPLE_DATA="${SAMPLE_DATA:-true}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: scripts/deploy.sh YOUR_PROJECT_ID   (see docs/DEPLOY.md)" >&2
  exit 2
fi

for tool in gcloud terraform docker git; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing $tool. See docs/DEPLOY.md, step 1." >&2
    exit 1
  fi
done

cd "$(dirname "$0")/.."
TF_VARS=(-var "project_id=$PROJECT_ID" -var "region=$REGION")

echo "==> 1/4 Preparing Terraform"
terraform -chdir=infra init -input=false

echo "==> 2/4 Enabling APIs and creating the image registry"
# Cloud Run needs an image before the service can exist, and the image needs a
# registry to live in. So create the registry first (-target), push, then the rest.
terraform -chdir=infra apply -input=false "${TF_VARS[@]}" \
  -target=google_project_service.apis \
  -target=google_artifact_registry_repository.app

echo "==> 3/4 Building and pushing the container image (linux/amd64 for Cloud Run)"
REPOSITORY="$REGION-docker.pkg.dev/$PROJECT_ID/fan-insights"
# Tag with the git commit, so every running version traces back to its code.
TAG="$(git rev-parse --short HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then TAG="$TAG-dirty-$(date +%Y%m%d%H%M%S)"; fi
IMAGE="$REPOSITORY/app:$TAG"
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
docker buildx build --platform linux/amd64 -t "$IMAGE" --push .

echo "==> 4/4 Creating BigQuery, permissions, and the Cloud Run service"
terraform -chdir=infra apply -input=false "${TF_VARS[@]}" -var "image=$IMAGE" -var "sample_data=$SAMPLE_DATA"

URL="$(terraform -chdir=infra output -raw url)"
echo
echo "Deployed $IMAGE"
echo "Dashboard: $URL"
echo
echo "First deploy? Load data into BigQuery, then refresh the page:"
echo "  python3 ingest/load_to_bigquery.py --project $PROJECT_ID --data data/sample"
