#!/usr/bin/env bash
# One-time setup that lets GitHub Actions deploy to Cloud Run without a stored key.
#
#   scripts/setup-github-deploy.sh YOUR_PROJECT_ID
#
# Run it once, logged in as the project owner (Google Cloud Shell works:
# https://shell.cloud.google.com). Safe to run again; it skips what exists.
#
# How the keyless login works (Workload Identity Federation): on each run,
# GitHub hands the workflow a short-lived signed token saying "this is repo
# ademco/creatordash, branch main". Google checks the signature, and only a
# token matching that repo and branch may act as the deploy service account,
# for about an hour. There is no password or key file to leak.
#
# Creates (all free): a service account, a workload identity pool and provider,
# and four permission grants. Nothing that runs or stores data.
set -euo pipefail

PROJECT_ID="${1:-}"
REPO="${REPO:-ademco/creatordash}"
REGION="${REGION:-us-central1}"
POOL="github"
PROVIDER="github-oidc"
DEPLOYER="github-deployer"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: scripts/setup-github-deploy.sh YOUR_PROJECT_ID" >&2
  exit 2
fi

DEPLOY_SA="$DEPLOYER@$PROJECT_ID.iam.gserviceaccount.com"
RUNTIME_SA="fan-insights-run@$PROJECT_ID.iam.gserviceaccount.com"
NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud config set project "$PROJECT_ID" --quiet >/dev/null 2>&1

echo "==> 1/4 Turning on the token-exchange APIs"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --quiet

echo "==> 2/4 Creating the deploy service account"
if ! gcloud iam service-accounts describe "$DEPLOY_SA" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$DEPLOYER" \
    --display-name "GitHub Actions deployer" \
    --description "Pushes images and rolls out new Cloud Run revisions. Used only by $REPO on main."
fi

echo "==> 3/4 Giving it exactly what a deploy needs"
# Push images to this one registry.
gcloud artifacts repositories add-iam-policy-binding fan-insights \
  --location "$REGION" --member "serviceAccount:$DEPLOY_SA" \
  --role roles/artifactregistry.writer --quiet >/dev/null
# Roll out new revisions. run.developer can't change who may view the
# service; that stays in Terraform.
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$DEPLOY_SA" --role roles/run.developer \
  --condition None --quiet >/dev/null
# A new revision runs as fan-insights-run, so the deployer must be allowed to
# hand that identity to Cloud Run (and only that one).
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member "serviceAccount:$DEPLOY_SA" --role roles/iam.serviceAccountUser --quiet >/dev/null

echo "==> 4/4 Trusting GitHub's tokens for $REPO on main only"
if ! gcloud iam workload-identity-pools describe "$POOL" --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --location global \
    --display-name "GitHub Actions"
fi
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER" \
  --location global --workload-identity-pool "$POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --location global --workload-identity-pool "$POOL" \
    --display-name "GitHub" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '$REPO' && assertion.ref == 'refs/heads/main'"
fi
# A service account created a moment ago can take a minute to be visible to
# IAM everywhere, and until then this fails with PERMISSION_DENIED "(or it may
# not exist)". So retry for up to two minutes before giving up.
for attempt in 1 2 3 4 5 6 7 8; do
  if gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
    --role roles/iam.workloadIdentityUser \
    --member "principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO" \
    --quiet >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 8 ]]; then
    echo "Still can't update $DEPLOY_SA. Wait a few minutes and run this script again." >&2
    exit 1
  fi
  echo "    The new service account isn't visible yet; retrying in 15 seconds..."
  sleep 15
done

echo
echo "Done. Send this line to whoever is setting up the workflow:"
echo "  project number: $NUMBER"
