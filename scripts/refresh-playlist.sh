#!/bin/bash
# Full playlist refresh: back up, reseed channels + media from an M3U, repair,
# and replay hand-curated CMS state.
#
# Usage: ./scripts/refresh-playlist.sh [local|prod] [m3u-file]
#   defaults: local, ~/uploads/updatechannels.m3u
#
# Env switches:
#   SKIP_DUMP=1     skip the pg_dump safety net (curation CSVs are still taken)
#   SKIP_RESTORE=1  reseed only — leave everything inactive, no curation replay
#
# See ../README.md for the manual step-by-step and the reasoning behind each
# repair. This script is that runbook, in order.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_ROOT="$PROJECT_ROOT/../env-profiles"
BACKUP_DIR="$PROJECT_ROOT/../data/backups"

ENV_NAME="${1:-local}"
M3U_FILE="${2:-$HOME/uploads/updatechannels.m3u}"

if [[ "$ENV_NAME" == "prod" ]]; then
  source "$ENV_ROOT/prod.env"
else
  source "$ENV_ROOT/local.env"
fi

# Add Homebrew PostgreSQL to PATH if needed
if ! command -v psql &> /dev/null; then
  export PATH="/opt/homebrew/opt/postgresql@15/bin:/opt/homebrew/Cellar/postgresql@15/15.14/bin:$PATH"
fi

# ─── Preflight ──────────────────────────────────────────────

if [[ ! -f "$M3U_FILE" ]]; then
  echo "❌ File not found: $M3U_FILE"
  exit 1
fi

if ! command -v psql &> /dev/null; then
  echo "❌ psql not on PATH"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL is not set (checked $ENV_ROOT/$ENV_NAME.env)"
  exit 1
fi

if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "❌ Cannot connect to the database"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "🎬 Refreshing from $M3U_FILE"
echo "   env: $ENV_NAME   schema: ${DB_SCHEMA:-public}"
echo ""

# ─── Detect the provider base URL ───────────────────────────
# The seed scripts strip scheme://host:port/ from every URL, so we need to know
# which host is "the base" in order to spot the ones that are not (step 3a).

echo "🔍 Detecting provider base URL..."
BASE_URL="$(awk '
  { sub(/\r$/, "") }
  /^https?:\/\// {
    if (match($0, /^https?:\/\/[^\/]+\//)) c[substr($0, RSTART, RLENGTH)]++
  }
  END { n = 0; for (k in c) if (c[k] > n) { n = c[k]; b = k } print b }
' "$M3U_FILE")"

if [[ -z "$BASE_URL" ]]; then
  echo "❌ No http(s) URLs found in $M3U_FILE — is this an M3U?"
  exit 1
fi
echo "   playlist serves from: $BASE_URL"

# Compare against STREAM_BASE_PATH, which is what exports actually point at.
if [[ -n "${STREAM_BASE_PATH:-}" ]]; then
  playlist_host="${BASE_URL#*://}"; playlist_host="${playlist_host%%[:/]*}"
  configured_host="${STREAM_BASE_PATH#*://}"; configured_host="${configured_host%%[:/]*}"
  if [[ "$playlist_host" != "$configured_host" ]]; then
    echo "⚠️  STREAM_BASE_PATH is $STREAM_BASE_PATH (host: $configured_host)"
    echo "   but this playlist serves from $playlist_host."
    echo "   Stored URLs are host-agnostic so the import is fine, but exports will"
    echo "   point at $configured_host. Update env-profiles/*.env if that is stale."
  fi
fi
echo ""

# ─── 1. Back up ─────────────────────────────────────────────

if [[ "${SKIP_DUMP:-}" != "1" ]]; then
  DUMP_FILE="$BACKUP_DIR/iptvchannels-preupdate.dump"
  echo "💾 Dumping schema to $(basename "$DUMP_FILE")..."
  pg_dump "$DATABASE_URL" -n "${DB_SCHEMA:-public}" -Fc -f "$DUMP_FILE"
  echo "   $(du -h "$DUMP_FILE" | cut -f1)"
else
  echo "⏭️  SKIP_DUMP=1 — no pg_dump taken"
fi

# Snapshot hand-curated CMS state. The seeds truncate, so this has to happen
# first. One snapshot, overwritten each run — no history is kept.
SNAP_DIR="$BACKUP_DIR/curation"
mkdir -p "$SNAP_DIR"
echo "📋 Snapshotting curated state to $(basename "$SNAP_DIR")/..."
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 \
 -c "\COPY (SELECT stream_url, tvg_name, name, country_code, favourite, active, script_alias, content_id FROM channels WHERE active OR favourite OR script_alias IS NOT NULL OR content_id IS NOT NULL OR country_code IS NOT NULL OR (name IS NOT NULL AND name <> tvg_name)) TO '$SNAP_DIR/channels-curation.csv' CSV HEADER" \
 -c "\COPY (SELECT stream_url, tvg_name, name, favourite, active FROM media WHERE active OR favourite OR (name IS NOT NULL AND name <> tvg_name)) TO '$SNAP_DIR/media-curation.csv' CSV HEADER" \
 -c "\COPY (SELECT tvg_name, name, favourite, active FROM series WHERE active OR favourite OR (name IS NOT NULL AND name <> tvg_name)) TO '$SNAP_DIR/series-curation.csv' CSV HEADER" \
 -c "\COPY (SELECT name, alias FROM group_titles) TO '$SNAP_DIR/group-titles.csv' CSV HEADER"

# Data rows in a CSV, i.e. line count minus the header. Clamped at 0 so a
# truncated or headerless file cannot report -1 into the arithmetic below.
csv_rows() {
  local n
  [[ -f "$1" ]] || { echo 0; return; }
  n=$(( $(wc -l < "$1") - 1 ))
  (( n > 0 )) && echo "$n" || echo 0
}

SNAP_ROWS=$(( $(csv_rows "$SNAP_DIR/channels-curation.csv") \
            + $(csv_rows "$SNAP_DIR/media-curation.csv") \
            + $(csv_rows "$SNAP_DIR/series-curation.csv") ))
echo "   $SNAP_ROWS curated rows"
echo ""

# ─── 2. Reseed ──────────────────────────────────────────────

echo "📺 Seeding channels..."
"$SCRIPT_DIR/seed-channels.sh" "$ENV_NAME" "$M3U_FILE"
echo ""
echo "🎥 Seeding movies and series (slow — ~1.3M rows)..."
"$SCRIPT_DIR/seed-media.sh" "$ENV_NAME" "$M3U_FILE"
echo ""

# ─── 3a. Channels not served from the provider base ─────────
# The seed awk strips any scheme://host:port/, which turns foreign-CDN channels
# into paths that would wrongly resolve against STREAM_BASE_PATH. Give them
# their absolute URL back — buildStreamUrl() passes absolute URLs through.

echo "🔧 Restoring channels served from other hosts..."
awk -v base="$BASE_URL" '
  { sub(/\r$/, "") }
  /^https?:\/\// {
    if (index($0, base) != 1) {
      p = $0; sub(/^https?:\/\/[^\/]+\//, "", p)
      print p "\t" $0
    }
  }
' "$M3U_FILE" > "$TMP_DIR/foreign-map.tsv"

FOREIGN_COUNT=$(wc -l < "$TMP_DIR/foreign-map.tsv")
if [[ "$FOREIGN_COUNT" -gt 0 ]]; then
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 \
   -c "CREATE TEMP TABLE foreign_map (path text, full_url text);" \
   -c "\COPY foreign_map FROM '$TMP_DIR/foreign-map.tsv'" \
   -c "UPDATE channels c SET stream_url = f.full_url, updated_at = now()
       FROM foreign_map f WHERE c.stream_url = f.path;"
fi
echo "   $FOREIGN_COUNT channel(s) kept absolute"

# ─── 3b. Group titles orphaned by the swap ──────────────────
# group_titles is shared by all three tables and never truncated. Only safe
# after BOTH seeds — after channels alone, media still references the old rows.

echo "🧹 Removing group titles left behind by the previous playlist..."
ORPHANS=$(psql "$DATABASE_URL" -t -A -v ON_ERROR_STOP=1 -c "
WITH deleted AS (
  DELETE FROM group_titles g
  WHERE NOT EXISTS (SELECT 1 FROM channels c WHERE c.group_title_id = g.id)
    AND NOT EXISTS (SELECT 1 FROM media    m WHERE m.group_title_id = g.id)
    AND NOT EXISTS (SELECT 1 FROM series   s WHERE s.group_title_id = g.id)
  RETURNING 1
) SELECT count(*) FROM deleted;")
echo "   $ORPHANS removed"
echo ""

# ─── 4. Replay curation ─────────────────────────────────────

if [[ "${SKIP_RESTORE:-}" == "1" ]]; then
  echo "⏭️  SKIP_RESTORE=1 — everything left inactive"
  echo "   Snapshot kept at $SNAP_DIR"
elif [[ "$SNAP_ROWS" -eq 0 ]]; then
  echo "⏭️  Nothing curated to replay"
else
  echo "♻️  Replaying curation from $(basename "$SNAP_DIR")/..."
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 \
   -c "CREATE TEMP TABLE ch_cur (stream_url text, tvg_name text, name text, country_code text, favourite bool, active bool, script_alias text, content_id int);" \
   -c "\COPY ch_cur FROM '$SNAP_DIR/channels-curation.csv' CSV HEADER" \
   -c "CREATE TEMP TABLE md_cur (stream_url text, tvg_name text, name text, favourite bool, active bool);" \
   -c "\COPY md_cur FROM '$SNAP_DIR/media-curation.csv' CSV HEADER" \
   -c "CREATE TEMP TABLE sr_cur (tvg_name text, name text, favourite bool, active bool);" \
   -c "\COPY sr_cur FROM '$SNAP_DIR/series-curation.csv' CSV HEADER" \
   -c "UPDATE channels c SET active = k.active, favourite = k.favourite,
         country_code = k.country_code, script_alias = k.script_alias,
         content_id = k.content_id,
         name = CASE WHEN k.name IS DISTINCT FROM k.tvg_name THEN k.name ELSE c.name END,
         updated_at = now()
       FROM ch_cur k WHERE c.stream_url = k.stream_url;" \
   -c "UPDATE media m SET active = k.active, favourite = k.favourite,
         name = CASE WHEN k.name IS DISTINCT FROM k.tvg_name THEN k.name ELSE m.name END,
         updated_at = now()
       FROM md_cur k WHERE m.stream_url = k.stream_url;" \
   -c "UPDATE series s SET active = k.active, favourite = k.favourite,
         name = CASE WHEN k.name IS DISTINCT FROM k.tvg_name THEN k.name ELSE s.name END,
         updated_at = now()
       FROM sr_cur k WHERE s.tvg_name = k.tvg_name;" \
   -c "CREATE TEMP TABLE dropped AS
       SELECT k.tvg_name, k.name, k.active, k.script_alias, k.content_id
       FROM ch_cur k
       WHERE NOT EXISTS (SELECT 1 FROM channels c WHERE c.stream_url = k.stream_url);" \
   -c "\COPY (SELECT * FROM dropped) TO '$SNAP_DIR/dropped-channels.csv' CSV HEADER" \
   -c "SELECT tvg_name, name, script_alias, content_id FROM dropped;"

  DROPPED=$(( $(csv_rows "$SNAP_DIR/dropped-channels.csv") ))
  if [[ "$DROPPED" -gt 0 ]]; then
    echo "⚠️  $DROPPED curated channel(s) are gone from the new playlist (listed above)."
    echo "   Their Home Assistant scripts are now dangling."
    echo "   Saved to $(basename "$SNAP_DIR")/dropped-channels.csv"
  fi
fi
echo ""

# ─── 5. Verify ──────────────────────────────────────────────

echo "✅ Done. Final state:"
psql "$DATABASE_URL" -c "
SELECT (SELECT count(*) FROM channels)                                             AS channels,
       (SELECT count(*) FROM media WHERE series_id IS NULL AND media_type='movie') AS movies,
       (SELECT count(*) FROM series)                                               AS series,
       (SELECT count(*) FROM media WHERE series_id IS NOT NULL)                    AS episodes,
       (SELECT count(*) FROM group_titles)                                         AS group_titles;"

psql "$DATABASE_URL" -c "
SELECT 'channels' AS tbl,
       count(*) FILTER (WHERE stream_url ~ E'\r')        AS cr_in_url,
       count(*) FILTER (WHERE stream_url LIKE 'http%')   AS absolute_urls,
       count(*) FILTER (WHERE active)                    AS active
FROM channels
UNION ALL
SELECT 'media',
       count(*) FILTER (WHERE stream_url ~ E'\r'),
       count(*) FILTER (WHERE stream_url LIKE 'http%'),
       count(*) FILTER (WHERE active)
FROM media;"

echo "Expected: cr_in_url 0 everywhere; absolute_urls 0 on media and $FOREIGN_COUNT on channels."
echo ""
echo "Next: hit /channels/yaml (or the Sync Kodi button) to re-resolve Kodi"
echo "content ids — PVR ids drift and the snapshot only restores the old ones."
