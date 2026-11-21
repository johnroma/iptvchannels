#!/usr/bin/env bash
# No dotenv, dev lifecycle hooks, database commands, or shared srv output.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if compgen -G '.env*' >/dev/null; then
  printf '%s\n' 'Use a clean worktree without root .env files for maintenance gates.' >&2
  exit 1
fi
# Only these environment keys cross into tools; in particular DATABASE_URL,
# KODI_*, VERCEL_*, NODE_OPTIONS and NITRO_OUTPUT_DIR are never inherited.
clean=(env -i "HOME=$HOME" "PATH=$PATH" CI=1)
[[ "$("${clean[@]}" pnpm --version)" == '10.33.0' ]]
"${clean[@]}" pnpm install --frozen-lockfile --strict-peer-dependencies --ignore-scripts
"${clean[@]}" pnpm test:run
"${clean[@]}" node node_modules/eslint/bin/eslint.js . --max-warnings 0
"${clean[@]}" pnpm exec tsc --noEmit
"${clean[@]}" pnpm exec tsc --project packages/ui/tsconfig.json --noEmit
"${clean[@]}" NODE_ENV=production NITRO_PRESET=node-server NITRO_OUTPUT_DIR=.output/maintenance pnpm exec vite build
