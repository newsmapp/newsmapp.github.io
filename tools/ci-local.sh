#!/usr/bin/env bash
# Runs locally what .github/workflows/ci.yml runs on GitHub, in the same order, so a push to main
# only goes out once it already passed here.
#
#   tools/ci-local.sh          both jobs: "check" (real catalog) and "e2e" (fixture catalog)
#   tools/ci-local.sh check    only the first job
#   tools/ci-local.sh e2e      only the second job
#
# Needs Node 24 (nvm use 24) and the Playwright Chromium (pnpm exec playwright install chromium).
set -euo pipefail
cd "$(dirname "$0")/.."

job="${1:-all}"
started=$SECONDS
step() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }

node_major=$(node -p 'process.versions.node.split(".")[0]')
[[ "$node_major" == 24 ]] || { echo "Node 24 required (found $(node -v)): nvm use 24" >&2; exit 1; }

# Lighthouse needs a Chrome; under WSL there is usually none besides Playwright's.
if [[ -z "${CHROME_PATH:-}" ]]; then
  chrome=$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux64/chrome 2>/dev/null | sort -V | tail -1 || true)
  [[ -n "$chrome" ]] && export CHROME_PATH="$chrome"
fi

# Under WSL, chrome-launcher takes the Windows temp path for its Chrome profile and creates it,
# relative, in the repository ("C:\Users\...\lighthouse.XXXXXX"); it never removes them.
cleanup() { find . -maxdepth 1 -name 'C:*' -type d -exec rm -rf {} +; }
trap cleanup EXIT

check_job() {
  step 'install (frozen lockfile)' && pnpm install --frozen-lockfile --prefer-offline
  step 'format:check' && pnpm format:check
  step 'lint' && pnpm lint
  step 'typecheck' && pnpm typecheck
  step 'catalog:validate' && pnpm catalog:validate
  step 'test:coverage' && pnpm test:coverage
  step 'build (production catalog)' && pnpm build
  step 'seo:audit' && pnpm seo:audit
}

e2e_job() {
  export CATALOG_DIR=tests/fixtures/catalog
  step 'build (fixture catalog)' && pnpm build
  step 'seo:audit' && pnpm seo:audit
  step 'e2e + a11y' && CI=1 pnpm e2e
  step 'lighthouse' && pnpm lhci
  unset CATALOG_DIR
}

case "$job" in
  check) check_job ;;
  e2e) e2e_job ;;
  all) check_job && e2e_job ;;
  *) echo "usage: tools/ci-local.sh [check|e2e]" >&2; exit 2 ;;
esac

# The e2e job leaves a fixture build in dist/; rebuild before `pnpm preview`.
printf '\n\033[1;32m✔ CI (%s) passed locally in %ss\033[0m\n' "$job" "$((SECONDS - started))"
