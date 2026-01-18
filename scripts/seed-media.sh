#!/bin/bash
# Seed movies/series from M3U (.mp4/.mkv entries only)
# Usage: ./scripts/seed-media.sh [local|prod] [m3u-file]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$PROJECT_ROOT/../assets"
M3U_FILE="${2:-$ASSETS_DIR/seedchannels.m3u}"
CSV_FILE="/tmp/media_import.csv"

ENV="${1:-local}"
if [[ "$ENV" == "prod" ]]; then
  source "$PROJECT_ROOT/env-profiles/prod.env"
else
  source "$PROJECT_ROOT/env-profiles/local.env"
fi

# Add Homebrew PostgreSQL to PATH if needed
if ! command -v psql &> /dev/null; then
  export PATH="/opt/homebrew/opt/postgresql@15/bin:/opt/homebrew/Cellar/postgresql@15/15.14/bin:$PATH"
fi

if [[ ! -f "$M3U_FILE" ]]; then
  echo "❌ File not found: $M3U_FILE"
  exit 1
fi

echo "🔄 Parsing media from $M3U_FILE..."
echo "   (processing .mp4/.mkv entries only - this may take a while)"

# Parse M3U with awk - validates pairs before processing
# Only accepts: #EXTINF line followed by http URL ending in .mp4/.mkv
# Compatible with BSD awk (macOS)
awk '
BEGIN {
  FS="\""
  print "tvg_id\ttvg_name\ttvg_logo\tgroup_title\tstream_url\tmedia_type\tyear\tseason\tepisode"
  has_extinf = 0
  skipped = 0
  count = 0
  started = 0
}

/^#EXTINF:/ {
  # If we had a pending EXTINF without a valid URL, skip it
  if (has_extinf) {
    skipped++
  }

  # Parse this EXTINF line
  tvg_id = ""; tvg_name = ""; tvg_logo = ""; group_title = ""
  for (i = 1; i <= NF; i++) {
    if ($(i) ~ /tvg-id=$/) tvg_id = $(i+1)
    else if ($(i) ~ /tvg-name=$/) tvg_name = $(i+1)
    else if ($(i) ~ /tvg-logo=$/) tvg_logo = $(i+1)
    else if ($(i) ~ /group-title=$/) group_title = $(i+1)
  }
  has_extinf = 1
  next
}

/^http/ {
  # Only process if we have a pending EXTINF
  if (!has_extinf) {
    next
  }

  url = $0

  # Only process media files (.mp4/.mkv)
  if (url !~ /\.(mp4|mkv)$/) {
    has_extinf = 0
    next
  }

  if (!started) {
    print "⚡ First media entry at line " NR > "/dev/stderr"
    started = 1
  }

  # Validate we have required fields
  if (tvg_name == "") {
    skipped++
    has_extinf = 0
    next
  }

  # Determine media type from URL
  media_type = ""
  if (url ~ /\/movie\//) media_type = "movie"
  else if (url ~ /\/series\//) media_type = "series"

  # Parse year from title like "(1994)" - BSD awk compatible
  year = ""
  if (match(tvg_name, /\([0-9][0-9][0-9][0-9]\)/)) {
    year = substr(tvg_name, RSTART + 1, 4)
  }

  # Parse season/episode from title - BSD awk compatible
  # Match S02 E11 or S02E11 patterns
  season = ""; episode = ""
  tmp_name = tvg_name
  # Convert to uppercase for matching
  gsub(/s/, "S", tmp_name)
  gsub(/e/, "E", tmp_name)
  if (match(tmp_name, /S[0-9][0-9]? ?E[0-9][0-9]?[0-9]?/)) {
    se_str = substr(tmp_name, RSTART, RLENGTH)
    # Extract season number after S
    if (match(se_str, /S[0-9][0-9]?/)) {
      season = substr(se_str, RSTART + 1, RLENGTH - 1) + 0
    }
    # Extract episode number after E
    if (match(se_str, /E[0-9][0-9]?[0-9]?/)) {
      episode = substr(se_str, RSTART + 1, RLENGTH - 1) + 0
    }
  }

  # Escape tabs in fields
  gsub(/\t/, " ", tvg_id)
  gsub(/\t/, " ", tvg_name)
  gsub(/\t/, " ", tvg_logo)
  gsub(/\t/, " ", group_title)

  print tvg_id "\t" tvg_name "\t" tvg_logo "\t" group_title "\t" url "\t" media_type "\t" year "\t" season "\t" episode

  count++
  has_extinf = 0

  # Progress every 100k
  if (count % 100000 == 0) {
    print "   processed " count " media entries..." > "/dev/stderr"
  }
  next
}

# Any other line resets the state (invalid pair)
/^[^#]/ && !/^http/ {
  if (has_extinf) {
    skipped++
    has_extinf = 0
  }
}

END {
  if (has_extinf) skipped++
  print "📊 Media: " count ", Skipped invalid: " skipped > "/dev/stderr"
}
' "$M3U_FILE" > "$CSV_FILE"

MEDIA_COUNT=$(($(wc -l < "$CSV_FILE") - 1))
echo "📊 Found $MEDIA_COUNT media entries"

if [[ "$MEDIA_COUNT" -eq 0 ]]; then
  echo "⚠️  No media found, skipping import"
  rm -f "$CSV_FILE"
  exit 0
fi

echo "🗑️  Truncating media table..."
psql "$DATABASE_URL" -c "TRUNCATE TABLE media RESTART IDENTITY CASCADE;"

echo "📥 Importing media via COPY (this may take a while for large datasets)..."
psql "$DATABASE_URL" -c "\COPY media(tvg_id, tvg_name, tvg_logo, group_title, stream_url, media_type, year, season, episode) FROM '$CSV_FILE' WITH (FORMAT csv, DELIMITER E'\t', HEADER true, NULL '')"

# Set defaults for columns not in CSV
psql "$DATABASE_URL" -c "UPDATE media SET name = tvg_name, active = false, favourite = false WHERE name IS NULL;"

echo "✅ Imported $MEDIA_COUNT media entries!"
rm -f "$CSV_FILE"
