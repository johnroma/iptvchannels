-- Performance indexes: trigram search + B-tree pagination
-- Addresses slow ILIKE search (full table scans) and deep OFFSET pagination (external sort spill)

-- pg_trgm: enables GIN index-backed substring search for ILIKE '%query%'
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ═══ MEDIA (movies only: series_id IS NULL, ~180K rows) ════════════════════
-- Partial indexes: only index movie rows, not the 1M+ series episode rows

-- Trigram GIN indexes for ILIKE search on name and tvg_name
CREATE INDEX IF NOT EXISTS media_name_trgm_idx
  ON iptvchannels.media USING gin (name gin_trgm_ops)
  WHERE series_id IS NULL;

CREATE INDEX IF NOT EXISTS media_tvg_name_trgm_idx
  ON iptvchannels.media USING gin (tvg_name gin_trgm_ops)
  WHERE series_id IS NULL;

-- B-tree composite for ORDER BY name, id pagination (index scan replaces seq scan + sort)
CREATE INDEX IF NOT EXISTS media_name_id_idx
  ON iptvchannels.media (name, id)
  WHERE series_id IS NULL;

-- B-tree composite for ORDER BY created_at, id pagination
CREATE INDEX IF NOT EXISTS media_created_at_id_idx
  ON iptvchannels.media (created_at, id)
  WHERE series_id IS NULL;

-- ═══ SERIES (parent table, ~40K rows) ══════════════════════════════════════
-- No partial filter — all series rows are listed/searched directly

CREATE INDEX IF NOT EXISTS series_name_trgm_idx
  ON iptvchannels.series USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS series_tvg_name_trgm_idx
  ON iptvchannels.series USING gin (tvg_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS series_name_id_idx
  ON iptvchannels.series (name, id);

CREATE INDEX IF NOT EXISTS series_created_at_id_idx
  ON iptvchannels.series (created_at, id);

-- ═══ CHANNELS (~48K rows) ══════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS channels_name_trgm_idx
  ON iptvchannels.channels USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS channels_tvg_name_trgm_idx
  ON iptvchannels.channels USING gin (tvg_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS channels_name_id_idx
  ON iptvchannels.channels (name, id);

CREATE INDEX IF NOT EXISTS channels_created_at_id_idx
  ON iptvchannels.channels (created_at, id);
