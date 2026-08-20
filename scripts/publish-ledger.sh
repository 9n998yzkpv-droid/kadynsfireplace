#!/usr/bin/env bash
#
# Validate the transaction ledger, then publish it.
#
#   ./scripts/publish-ledger.sh            # show derived state, confirm, push
#   ./scripts/publish-ledger.sh --yes      # skip the confirmation
#   ./scripts/publish-ledger.sh --dry-run  # validate only, change nothing
#
# Pushing transactions.json to main triggers the Update Portfolio Data
# workflow, which rebuilds public/data.json and redeploys the public
# dashboard. That is a live, public number, so this script refuses to push a
# ledger that does not parse or does not replay, and shows you the derived
# holdings before it commits.
#
# It stages ONLY transactions.json — other work in progress is left alone.
set -euo pipefail

cd "$(dirname "$0")/.."

LEDGER="transactions.json"
ASSUME_YES=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y)    ASSUME_YES=1 ;;
    --dry-run|-n) DRY_RUN=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

fail() { echo "✗ $*" >&2; exit 1; }

# ── 1. is there anything to publish? ────────────────────────────────────────
if git diff --quiet -- "$LEDGER" && git diff --cached --quiet -- "$LEDGER"; then
  echo "No changes to $LEDGER."
  # An unpushed commit from an earlier run still deserves a push.
  if [ -n "$(git log --oneline @{u}.. 2>/dev/null || true)" ]; then
    echo "…but you have unpushed commits. Run: git push"
  fi
  exit 0
fi

# ── 2. validate before anything is committed ────────────────────────────────
python3 -c "import json,sys; json.load(open('$LEDGER'))" \
  || fail "$LEDGER is not valid JSON — fix it before publishing."

python3 pipeline/test_ledger.py >/dev/null 2>&1 \
  || fail "Ledger engine tests failed. Run: python3 pipeline/test_ledger.py"
echo "✓ JSON parses, engine tests pass"

# Replays the ledger; exits non-zero on an impossible history (e.g. overselling).
python3 pipeline/ledger.py || fail "Ledger failed to replay — see the error above."

# ── 3. show exactly what would go live ──────────────────────────────────────
echo "── changes to $LEDGER ──"
git --no-pager diff --stat -- "$LEDGER"
git --no-pager diff -- "$LEDGER" | grep -E '^[+-]' | grep -vE '^[+-]{3}' | head -40

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || echo "⚠  on branch '$BRANCH', not main — the site deploys from main"

if [ "$DRY_RUN" = "1" ]; then
  echo "--dry-run: nothing committed or pushed."
  exit 0
fi

# ── 4. confirm ──────────────────────────────────────────────────────────────
if [ "$ASSUME_YES" != "1" ]; then
  printf "\nPublish these numbers to the public dashboard? [y/N] "
  read -r reply </dev/tty
  case "$reply" in [yY]*) ;; *) echo "Aborted — nothing committed."; exit 1 ;; esac
fi

# ── 5. commit and push ──────────────────────────────────────────────────────
git add "$LEDGER"
git commit -q -m "Update portfolio ledger"

# The nightly workflow commits data.json, so main often moved since your last
# pull. Rebase keeps history linear and avoids a rejected push.
git pull --rebase --autostash origin "$BRANCH"
git push origin "$BRANCH"

echo
echo "✓ Pushed. The Update Portfolio Data workflow rebuilds public/data.json"
echo "  and the dashboard redeploys in ~2 minutes."
echo "  Watch: gh run watch  (or the Actions tab)"
