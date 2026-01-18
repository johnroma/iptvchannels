#!/bin/bash
# Seed TV channels from M3U (stops at first .mp4/.mkv)
# Usage: ./scripts/seed-channels.sh [local|prod] [m3u-file]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$PROJECT_ROOT/../assets"
M3U_FILE="${2:-$ASSETS_DIR/seedchannels.m3u}"
CSV_FILE="/tmp/channels_import.csv"

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

echo "🔄 Parsing channels from $M3U_FILE..."
echo "   (stopping at first .mp4/.mkv entry)"

# Parse M3U with awk - validates pairs before processing
# Only accepts: #EXTINF line followed by http URL line
awk '
BEGIN {
  FS="\""
  print "tvg_id\ttvg_name\ttvg_logo\tgroup_title\tstream_url"
  has_extinf = 0
  skipped = 0
  count = 0
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
  extinf_line = NR
  next
}

/^http/ {
  # Only process if we have a pending EXTINF
  if (!has_extinf) {
    skipped++
    next
  }

  url = $0

  # Check if this is a media file - stop processing
  if (url ~ /\.(mp4|mkv)$/) {
    print "⚡ Stopped at line " NR " (first media entry)" > "/dev/stderr"
    print "📊 Channels: " count ", Skipped invalid: " skipped > "/dev/stderr"
    exit
  }

  # Validate we have required fields
  if (tvg_name == "") {
    skipped++
    has_extinf = 0
    next
  }

  # Escape tabs in fields
  gsub(/\t/, " ", tvg_id)
  gsub(/\t/, " ", tvg_name)
  gsub(/\t/, " ", tvg_logo)
  gsub(/\t/, " ", group_title)

  print tvg_id "\t" tvg_name "\t" tvg_logo "\t" group_title "\t" url
  count++
  has_extinf = 0
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
  print "📊 Channels: " count ", Skipped invalid: " skipped > "/dev/stderr"
}
' "$M3U_FILE" > "$CSV_FILE"

CHANNEL_COUNT=$(($(wc -l < "$CSV_FILE") - 1))
echo "📊 Found $CHANNEL_COUNT channels"

if [[ "$CHANNEL_COUNT" -eq 0 ]]; then
  echo "⚠️  No channels found, skipping import"
  rm -f "$CSV_FILE"
  exit 0
fi

echo "🗑️  Truncating channels table..."
psql "$DATABASE_URL" -c "TRUNCATE TABLE channels RESTART IDENTITY CASCADE;"

echo "📥 Importing channels via COPY..."
psql "$DATABASE_URL" -c "\COPY channels(tvg_id, tvg_name, tvg_logo, group_title, stream_url) FROM '$CSV_FILE' WITH (FORMAT csv, DELIMITER E'\t', HEADER true, NULL '')"

# Set defaults for columns not in CSV
psql "$DATABASE_URL" -c "UPDATE channels SET name = tvg_name, active = false, favourite = false WHERE name IS NULL;"

echo "✅ Imported $CHANNEL_COUNT channels!"
rm -f "$CSV_FILE"
