#!/bin/bash
# Seed movies/series from M3U (.mp4/.mkv entries only)
# Uses staging table pattern for normalized group_titles FK
# Creates series records and links episodes via series_id FK
# Usage: ./scripts/seed-media.sh [local|prod] [m3u-file]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$PROJECT_ROOT/../assets"

if [[ -z "$2" ]]; then
  echo "Usage: $0 [local|prod] [m3u-file]"
  exit 1
fi

M3U_FILE="$2"
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
# Now also extracts series_base_name (tvg_name with SXX EXX stripped)
awk '
BEGIN {
  FS="\""
  print "tvg_id\ttvg_name\ttvg_logo\tgroup_title\tstream_url\tmedia_type\tyear\tseason\tepisode\tseries_base_name"
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
  # Match S02 E11, S02E11, S2024 E6942 patterns (up to 4-digit season/episode)
  season = ""; episode = ""
  tmp_name = tvg_name
  # Convert to uppercase for matching
  gsub(/s/, "S", tmp_name)
  gsub(/e/, "E", tmp_name)
  if (match(tmp_name, /S[0-9][0-9]?[0-9]?[0-9]? ?E[0-9][0-9]?[0-9]?[0-9]?/)) {
    se_str = substr(tmp_name, RSTART, RLENGTH)
    # Extract season number after S
    if (match(se_str, /S[0-9][0-9]?[0-9]?[0-9]?/)) {
      season = substr(se_str, RSTART + 1, RLENGTH - 1) + 0
    }
    # Extract episode number after E
    if (match(se_str, /E[0-9][0-9]?[0-9]?[0-9]?/)) {
      episode = substr(se_str, RSTART + 1, RLENGTH - 1) + 0
    }
  }

  # Compute series_base_name: strip SXX EXX suffix for series with season info
  series_base_name = ""
  if (media_type == "series" && season != "") {
    series_base_name = tvg_name
    sub(/ ?[Ss][0-9][0-9]?[0-9]?[0-9]? ?[Ee][0-9][0-9]?[0-9]?[0-9]? *$/, "", series_base_name)
  }

  # Escape tabs in fields
  gsub(/\t/, " ", tvg_id)
  gsub(/\t/, " ", tvg_name)
  gsub(/\t/, " ", tvg_logo)
  gsub(/\t/, " ", group_title)
  gsub(/\t/, " ", series_base_name)

  print tvg_id "\t" tvg_name "\t" tvg_logo "\t" group_title "\t" url "\t" media_type "\t" year "\t" season "\t" episode "\t" series_base_name

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

echo "🗑️  Truncating media and series tables..."
psql "$DATABASE_URL" -c "TRUNCATE TABLE media RESTART IDENTITY CASCADE; TRUNCATE TABLE series RESTART IDENTITY CASCADE;"

echo "📥 Creating staging table and importing (this may take a while for large datasets)..."
psql "$DATABASE_URL" <<EOF
-- Create staging table with raw text group_title and series_base_name
CREATE TEMP TABLE media_staging (
  tvg_id TEXT,
  tvg_name TEXT NOT NULL,
  tvg_logo TEXT,
  group_title TEXT,
  stream_url TEXT,
  media_type TEXT,
  year INTEGER,
  season INTEGER,
  episode INTEGER,
  series_base_name TEXT
);

-- Import raw data
\COPY media_staging(tvg_id, tvg_name, tvg_logo, group_title, stream_url, media_type, year, season, episode, series_base_name) FROM '$CSV_FILE' WITH (FORMAT csv, DELIMITER E'\t', HEADER true, NULL '')

-- Insert distinct group titles (upsert) - may already exist from channels
INSERT INTO group_titles (name)
SELECT DISTINCT group_title FROM media_staging WHERE group_title IS NOT NULL AND group_title != ''
ON CONFLICT (name) DO NOTHING;

-- Insert distinct series records from staging (where series_base_name is set)
-- Use the first tvg_logo and group_title found for each series base name
INSERT INTO series (tvg_name, tvg_logo, group_title_id, name, active, favourite)
SELECT DISTINCT ON (s.series_base_name)
  s.series_base_name,
  s.tvg_logo,
  g.id,
  s.series_base_name,  -- default name to base name
  false,
  false
FROM media_staging s
LEFT JOIN group_titles g ON s.group_title = g.name
WHERE s.series_base_name IS NOT NULL AND s.series_base_name != ''
ORDER BY s.series_base_name, s.tvg_name;

-- Insert movies (no series_base_name) with series_id = NULL
INSERT INTO media (tvg_id, tvg_name, tvg_logo, group_title_id, stream_url, media_type, year, season, episode, series_id, name, active, favourite)
SELECT
  s.tvg_id,
  s.tvg_name,
  s.tvg_logo,
  g.id,
  s.stream_url,
  s.media_type,
  s.year,
  s.season,
  s.episode,
  NULL,
  s.tvg_name,
  false,
  false
FROM media_staging s
LEFT JOIN group_titles g ON s.group_title = g.name
WHERE s.series_base_name IS NULL OR s.series_base_name = '';

-- Insert series episodes with series_id FK lookup
INSERT INTO media (tvg_id, tvg_name, tvg_logo, group_title_id, stream_url, media_type, year, season, episode, series_id, name, active, favourite)
SELECT
  s.tvg_id,
  s.tvg_name,
  s.tvg_logo,
  g.id,
  s.stream_url,
  s.media_type,
  s.year,
  s.season,
  s.episode,
  sr.id,
  s.tvg_name,
  false,
  false
FROM media_staging s
LEFT JOIN group_titles g ON s.group_title = g.name
JOIN series sr ON s.series_base_name = sr.tvg_name
WHERE s.series_base_name IS NOT NULL AND s.series_base_name != '';

-- Update denormalized episode_count on series
UPDATE series SET episode_count = sub.cnt
FROM (
  SELECT series_id, COUNT(*)::int AS cnt
  FROM media
  WHERE series_id IS NOT NULL
  GROUP BY series_id
) sub
WHERE series.id = sub.series_id;

-- Staging table auto-drops at end of session
EOF

# Report counts
SERIES_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM series;" | tr -d ' ')
MOVIE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM media WHERE series_id IS NULL;" | tr -d ' ')
EPISODE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM media WHERE series_id IS NOT NULL;" | tr -d ' ')
echo "✅ Imported: $MOVIE_COUNT movies, $SERIES_COUNT series ($EPISODE_COUNT episodes)"
rm -f "$CSV_FILE"
