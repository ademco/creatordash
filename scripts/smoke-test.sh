#!/usr/bin/env bash
# Checks a running Fan Insights site from the outside.
#
#   scripts/smoke-test.sh https://fan-insights-xxxx.a.run.app
#
# Fails if the site is down or the numbers are empty, since that means the
# deploy is broken. News is reported but never fails the check: the feeds
# belong to other people and can be down for a while. It also fetches each
# feed in api/src/news-feeds.ts directly, so a dead or moved feed shows up by
# name. The deploy workflow runs this after every rollout.
set -euo pipefail

URL="${1:?Usage: scripts/smoke-test.sh SITE_URL}"
URL="${URL%/}"
cd "$(dirname "$0")/.."

# Sends one GraphQL query and prints the JSON answer.
graphql() {
  curl -sS -m 30 "$URL/graphql" -H 'content-type: application/json' -d "{\"query\":\"$1\"}"
}

# Reads a value out of JSON on stdin with a JavaScript expression over `d`.
json() {
  node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const d=JSON.parse(s);console.log(eval(process.argv[1]))})' "$1"
}

echo "==> Health"
curl -sS -m 30 -f "$URL/healthz" >/dev/null
echo "    ok"

echo "==> Numbers"
overview="$(graphql '{ overview(days: 90) { combinedAudience gained topPlatform } }')"
if [[ "$overview" == *'"errors"'* ]]; then
  echo "    The API returned an error: $overview" >&2
  exit 1
fi
audience="$(json 'd.data.overview.combinedAudience' <<<"$overview")"
if [[ "$audience" == 0 ]]; then
  echo "    combinedAudience is 0: the BigQuery tables are empty or unreadable. See docs/DEPLOY.md, step 6." >&2
  exit 1
fi
echo "    $(json '`${d.data.overview.combinedAudience} fans, +${d.data.overview.gained}, top: ${d.data.overview.topPlatform}`' <<<"$overview")"

echo "==> News on the site"
news="$(graphql '{ news(limit: 30) { live items { source title } } }')"
summary="$(json '(() => {
  const n = d.data && d.data.news;
  if (!n) return "error: " + JSON.stringify(d.errors || d);
  const by = {};
  for (const i of n.items) by[i.source] = (by[i.source] || 0) + 1;
  const parts = Object.entries(by).map(([s, c]) => `${s} (${c})`);
  return `${n.items.length} headlines, live=${n.live}` + (parts.length ? ": " + parts.join(", ") : "");
})()' <<<"$news")"
echo "    $summary"
[[ "$summary" == 0\ headlines* ]] && echo "::warning::The site shows no news. See the feed check below."

echo "==> Each news feed, fetched directly"
# The same addresses the API uses, read from the source so the list can't drift.
grep -o "url: '[^']*'" api/src/news-feeds.ts | cut -d"'" -f2 | while read -r feed; do
  body="$(curl -sS -m 15 -L -A 'fan-insights-smoke-test' -w '\n%{http_code}' "$feed" 2>&1 || true)"
  code="${body##*$'\n'}"
  entries="$( (grep -o -E '<(item|entry)[ >]' <<<"$body" || true) | wc -l | tr -d ' ')"
  if [[ "$code" == 200 && "$entries" -gt 0 ]]; then
    echo "    ok    $feed ($entries entries)"
  else
    echo "    FAIL  $feed (HTTP $code, $entries entries)"
    echo "::warning::News feed not usable: $feed (HTTP $code, $entries entries)"
  fi
done
