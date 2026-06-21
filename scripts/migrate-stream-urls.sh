#!/bin/bash
# One-time migration: strip scheme://host:port/ prefix from stream_url in all tables
# Run once after deploying the STREAM_BASE_PATH / STREAM_BASE_PORT env var change.
#
# Usage (env file already sourced or DATABASE_URL already set):
#   DATABASE_URL=postgresql://... ./scripts/migrate-stream-urls.sh
#
# Usage (source env file explicitly):
#   ./scripts/migrate-stream-urls.sh /path/to/env-profiles/local.env
#   ./scripts/migrate-stream-urls.sh /path/to/env-profiles/prod.env

set -e

# Add Homebrew PostgreSQL to PATH if needed
if ! command -v psql &> /dev/null; then
  export PATH="/opt/homebrew/opt/postgresql@15/bin:/opt/homebrew/Cellar/postgresql@15/15.14/bin:$PATH"
fi

# If an env file path is given as $1, source it
if [[ -n "$1" ]]; then
  if [[ ! -f "$1" ]]; then
    echo "❌ Env file not found: $1"
    exit 1
  fi
  source "$1"
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo "❌ DATABASE_URL is not set."
  echo "   Either pass an env file: $0 /path/to/env-profiles/local.env"
  echo "   Or set it in the environment: DATABASE_URL=postgres://... $0"
  exit 1
fi

echo "🔍 Checking stream_url values before migration..."
psql "$DATABASE_URL" -c "
SELECT
  'channels' AS tbl,
  COUNT(*) FILTER (WHERE stream_url LIKE 'http%') AS full_urls,
  COUNT(*) FILTER (WHERE stream_url NOT LIKE 'http%' AND stream_url IS NOT NULL) AS paths,
  COUNT(*) FILTER (WHERE stream_url IS NULL) AS nulls
FROM channels
UNION ALL
SELECT
  'media',
  COUNT(*) FILTER (WHERE stream_url LIKE 'http%'),
  COUNT(*) FILTER (WHERE stream_url NOT LIKE 'http%' AND stream_url IS NOT NULL),
  COUNT(*) FILTER (WHERE stream_url IS NULL)
FROM media;
"

echo ""
echo "⚙️  Stripping scheme://host:port/ prefix from stream_url..."
psql "$DATABASE_URL" <<'EOF'
UPDATE channels
SET stream_url = regexp_replace(stream_url, '^https?://[^/]+/', '')
WHERE stream_url LIKE 'http%';

UPDATE media
SET stream_url = regexp_replace(stream_url, '^https?://[^/]+/', '')
WHERE stream_url LIKE 'http%';
EOF

echo "✅ Done. Verify with:"
echo "   psql \"\$DATABASE_URL\" -c \"SELECT stream_url FROM channels LIMIT 3;\""
