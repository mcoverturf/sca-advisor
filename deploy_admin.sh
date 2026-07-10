#!/usr/bin/env bash
# ------------------------------------------------------------------
# Deploys the Sickle Cell Advisor with the /admin Knowledge Base
# Manager enabled. Idempotent — safe to re-run.
#
# What it does:
#   1. Deploys the app to Cloud Run (builds from source via Dockerfile)
#   2. Ensures ADMIN_KEY is set on the service (generates one if absent)
#   3. Grants the service account permission to run datastore imports
#   4. Smoke-tests the /admin page and prints the SME's URL + code
#
# Usage:  ./deploy_admin.sh
# ------------------------------------------------------------------
set -euo pipefail

PROJECT="gen-lang-client-0240369598"
REGION="us-central1"
SERVICE="genai-app-sicklecelladvisor-1-1782921246907"

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

command -v gcloud >/dev/null || die "gcloud CLI not found"
gcloud config set project "$PROJECT" --quiet >/dev/null

# --- 1. Deploy ----------------------------------------------------
say "Deploying $SERVICE to Cloud Run (this builds the container; takes a few minutes)"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --quiet

# --- 2. Ensure ADMIN_KEY ------------------------------------------
say "Checking ADMIN_KEY on the service"
EXISTING_KEY=$(gcloud run services describe "$SERVICE" --region "$REGION" --format=json \
  | python3 -c "import json,sys; envs=json.load(sys.stdin)['spec']['template']['spec']['containers'][0].get('env',[]); print(next((e.get('value','') for e in envs if e['name']=='ADMIN_KEY'),''))" || true)

if [[ -n "${EXISTING_KEY:-}" && "$EXISTING_KEY" != *"CHANGE-ME"* ]]; then
  ADMIN_KEY="$EXISTING_KEY"
  echo "ADMIN_KEY already set — keeping the existing code."
else
  ADMIN_KEY=$(openssl rand -hex 16)
  say "Setting a new ADMIN_KEY on the service"
  gcloud run services update "$SERVICE" \
    --region "$REGION" \
    --update-env-vars "ADMIN_KEY=$ADMIN_KEY" \
    --quiet
fi

# --- 3. IAM: allow the service to run datastore imports -----------
say "Granting Discovery Engine permissions to the runtime service account"
SA=$(gcloud run services describe "$SERVICE" --region "$REGION" \
  --format='value(spec.template.spec.serviceAccountName)')
[[ -z "$SA" ]] && SA="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
echo "Service account: $SA"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member "serviceAccount:$SA" \
  --role roles/discoveryengine.editor \
  --condition=None --quiet >/dev/null
echo "Granted roles/discoveryengine.editor (no-op if already granted)."

# --- 4. Smoke test -------------------------------------------------
URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')
say "Smoke-testing $URL/admin"
HTTP=$(curl -s -o /dev/null -w '%{http_code}' "$URL/admin")
[[ "$HTTP" == "200" ]] || die "/admin returned HTTP $HTTP — check the deploy logs"
AUTH=$(curl -s -o /dev/null -w '%{http_code}' -H "x-admin-key: $ADMIN_KEY" "$URL/api/admin/documents")
[[ "$AUTH" == "200" ]] || die "/api/admin/documents returned HTTP $AUTH — check ADMIN_KEY and IAM (grants can take 1-2 min to propagate; try re-running)"

say "SUCCESS"
echo
echo "  Give the SME this URL:    $URL/admin"
echo "  And this access code:     $ADMIN_KEY"
echo
echo "Store the access code somewhere safe — it is also visible via:"
echo "  gcloud run services describe $SERVICE --region $REGION --format='value(spec.template.spec.containers[0].env)'"
