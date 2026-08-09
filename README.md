# IPTV Channels

Channel management system for IPTV with Home Assistant and Kodi integration.

**Stack:** TanStack Start + Drizzle ORM + PostgreSQL/Supabase + Tailwind CSS v4 + shadcn/ui

## Project Structure

Note: this repo expects environment files in a sibling directory: `../env-profiles/` (one level above `iptvchannels/`). That directory is intentionally not part of this git repo.

```
iptvchannels/
├── src/
│   ├── routes/                 # TanStack Start file-based routing
│   │   ├── __root.tsx          # Document shell (<html>, <body>)
│   │   ├── index.tsx           # Home page
│   │   ├── channels.index.tsx  # Channel list (paginated, filtered)
│   │   ├── channels.$id.tsx    # Channel detail
│   │   ├── channels.new.tsx    # Create channel
│   │   ├── movies.index.tsx    # Movie list (paginated, filtered)
│   │   ├── movies.$id.tsx      # Movie detail
│   │   ├── movies.new.tsx      # Create movie
│   │   ├── series.index.tsx    # Series list (paginated)
│   │   ├── series.$id.tsx      # Series detail
│   │   ├── series.new.tsx      # Create series
│   │   ├── edit/$id.tsx        # Edit channel
│   │   ├── edit-movie/$id.tsx  # Edit movie
│   │   └── edit-series/$id.tsx # Edit series
│   ├── components/             # App components (forms, lists, switches, boundaries)
│   ├── server/                 # Server functions (createServerFn): shared.ts + channels/movies/series/kodi/m3u/yaml
│   ├── lib/                    # Pure utilities: m3u-parser, m3u-export, yaml-export, kodi-url, stream-url (+ tests)
│   ├── db/                     # Drizzle schema & client
│   │   ├── schema.ts           # Database schema (group_titles, channels, series, media) + relations
│   │   ├── validators.ts       # Zod validation schemas (channel/media/series + COUNTRY_CODES)
│   │   ├── index.ts            # Lazy-init DB client (Proxy) + re-exports
│   │   └── reset.ts            # Database reset script
│   ├── router.tsx              # Router + React Query SSR + custom search serialization
│   └── routeTree.gen.ts        # Auto-generated route tree
├── packages/
│   └── ui/                     # Shared UI components (shadcn/ui)
│       ├── components/         # shadcn components (button, input, card, select, etc.)
│       ├── lib/utils.ts        # cn() helper
│       ├── styles/globals.css  # Tailwind + CSS variables
│       ├── components.json     # shadcn CLI config
│       └── package.json
├── (uses ../env-profiles/)     # Environment configs (not in this repo)
├── scripts/
│   ├── seed-channels.sh        # M3U channel seeder (PostgreSQL COPY)
│   ├── seed-media.sh           # M3U media seeder (movies/series, PostgreSQL COPY)
│   └── migrate-stream-urls.sh  # Rewrite stream_url against STREAM_BASE_PATH/PORT
├── supabase/
│   ├── config.toml             # Supabase project config
│   └── migrations/             # Drizzle-generated migrations + meta snapshots
├── .understand-anything/       # Codebase knowledge graph (see /understand) — committed
├── eslint.config.mjs           # ESLint flat config (typescript-eslint)
├── drizzle.config.ts           # Drizzle Kit configuration
├── vite.config.ts              # Vite + TanStack Start + Tailwind + Nitro
├── nitro.config.ts             # Nitro server preset config
├── pnpm-workspace.yaml         # Workspace definition
└── package.json                # Root scripts
```

## Environment Setup

Environment files are stored in `../env-profiles/` and are **not committed to git**.

### Create Environment Files

```bash
cp ../env-profiles/.env.example ../env-profiles/local.env
cp ../env-profiles/.env.example ../env-profiles/prod.env
cp ../env-profiles/.env.example ../env-profiles/supabase.env
```

### Environment Profiles

| File | Purpose | Variables |
|------|---------|-----------|
| `../env-profiles/local.env` | Local development | `DATABASE_URL`, `DB_SCHEMA`, `KODI_URL` (preferred) or `KODI_HOST` + `KODI_PORT`, optional `KODI_USER`/`KODI_PASSWORD`, `STREAM_BASE_PATH`/`STREAM_BASE_PORT` |
| `../env-profiles/prod.env` | Production build + `srv/` runtime | Same as local, plus `NITRO_OUTPUT_DIR=../srv/.output` |
| `../env-profiles/supabase.env` | Supabase CLI | `SUPABASE_ACCESS_TOKEN` |

### Vercel Deployment

Set `DATABASE_URL` in Vercel environment variables to the Supabase connection string.

## Database Schema

### `group_titles` — Normalized lookup table

Shared by `channels`, `media`, and `series`. Changing an alias here updates it for all linked rows.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `name` | text | Original M3U value, UNIQUE (e.g., "US\| ENTERTAINMENT") |
| `alias` | text | Optional friendly override (e.g., "Entertainment") |

### `channels` — IPTV channel data

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `id` | uuid | auto | Primary key (random UUID) |
| `tvg_id` | text | M3U | EPG identifier |
| `tvg_name` | text | M3U | Channel name (e.g., "US\| ABC HD") |
| `tvg_logo` | text | M3U | Logo URL |
| `group_title_id` | integer | M3U/FK | FK → `group_titles.id` |
| `stream_url` | text | M3U | Stream URL |
| `content_id` | integer | Kodi | Kodi channel ID for playback |
| `name` | text | CMS | Custom display name |
| `country_code` | text | CMS | Country code (e.g., "US", "UK") |
| `favourite` | boolean | CMS | Mark as favourite |
| `active` | boolean | CMS | Include in YAML export |
| `script_alias` | text | CMS | Home Assistant script alias |
| `created_at` | timestamp | auto | Created timestamp |
| `updated_at` | timestamp | auto | Updated timestamp |

### `series` — Series groupings

Each row groups the `media` episodes that belong to one series (referenced via `media.series_id`).

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `id` | uuid | auto | Primary key (random UUID) |
| `tvg_id` | text | M3U | EPG identifier |
| `tvg_name` | text | M3U | Base series name (without `Sxx Exx`) |
| `tvg_logo` | text | M3U | Shared poster URL |
| `group_title_id` | integer | M3U/FK | FK → `group_titles.id` |
| `episode_count` | integer | derived | Denormalized episode count (maintained by seed/CRUD) |
| `name` | text | CMS | Custom display name |
| `favourite` | boolean | CMS | Mark as favourite |
| `active` | boolean | CMS | Include in M3U export |
| `created_at` | timestamp | auto | Created timestamp |
| `updated_at` | timestamp | auto | Updated timestamp |

### `media` — Movies and series episodes

Movies are `media` rows with `series_id IS NULL` and `media_type = "movie"`; series episodes set `series_id` and `media_type = "series"`. The Movies page and `/movies/m3u` filter to movie rows only.

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `id` | uuid | auto | Primary key (random UUID) |
| `tvg_id` | text | M3U | EPG identifier |
| `tvg_name` | text | M3U | Title (e.g., movie title or `... S02 E11`) |
| `tvg_logo` | text | M3U | Poster / logo URL |
| `group_title_id` | integer | M3U/FK | FK → `group_titles.id` |
| `series_id` | uuid | parsed/FK | FK → `series.id` (null for movies) |
| `stream_url` | text | M3U | Stream URL (`.mp4`/`.mkv`) |
| `media_type` | text | derived | `"movie"` or `"series"` (from URL path) |
| `year` | integer | parsed | Year parsed from title |
| `season` | integer | parsed | Season number (series) |
| `episode` | integer | parsed | Episode number (series) |
| `name` | text | CMS | Custom display name |
| `favourite` | boolean | CMS | Mark as favourite |
| `active` | boolean | CMS | Include in M3U export |
| `created_at` | timestamp | auto | Created timestamp |
| `updated_at` | timestamp | auto | Updated timestamp |

## Export YAML (Home Assistant)

This project does **not** call Home Assistant directly. Instead, it generates YAML you paste into Home Assistant (or include from a package) so Home Assistant can call *your* existing playback automation.

- `Export YAML` generates a **plain mapping of Home Assistant scripts** — script IDs at
  the top level, with no `script:` wrapper — so the file can be pulled in with
  `script: !include channels.yaml` (or `!include_dir_merge_named`).
- Each exported channel becomes a script keyed by `channels.script_alias`.
- The generated script uses `action:` (the current HA key; `service:` is deprecated)
  to call `script.play_channel` and passes:
  - `content_id` (Kodi PVR `channelid`, stored in `channels.content_id`)
  - `channel_title` (from `channels.tvg_name`)
  - `channel_thumbnail` (from `channels.tvg_logo`)

Shape of the output:

```yaml
channel_bbc1:
  alias: "BBC One"
  icon: mdi:view-stream
  sequence:
    - action: script.play_channel
      data:
        content_id: 2246
        channel_title: "UK| BBC 1"
        channel_thumbnail: "http://example.com/bbc.png"
```

Wire it up in `configuration.yaml`:

```yaml
script: !include channels.yaml
```

If no channel qualifies, the file is a comment plus `{}` so the `!include` still
yields an empty mapping rather than `null`.

Important: you must already have a `script.play_channel` in Home Assistant (or adapt the generator to call a different action). This repo only generates the per-channel wrappers.

### What gets exported

- Only channels with `active = true` are considered.
- A channel is exported only if it has both:
  - `script_alias` (used as the YAML key), and
  - `content_id` (the value passed to `script.play_channel`).
- Channels missing either field are skipped (the UI shows the skip reasons).

## Sync Kodi (optional helper for content_id)

The `Sync Kodi` button populates/refreshes `channels.content_id` by querying Kodi’s JSON-RPC API for the current PVR channel list and matching by name. It exists mainly to make `Export YAML` easier (so you don’t have to enter `content_id` manually).

### What “Sync Kodi” does

- Calls Kodi JSON-RPC `PVR.GetChannels` (`channelgroupid: "alltv"`) via `KODI_URL` (preferred) or `http://$KODI_HOST:$KODI_PORT/jsonrpc`
- Builds a map of `kodiChannel.label → kodiChannel.channelid` (case-insensitive)
- Matches each DB channel against that label by `channels.name` **first**, falling back to
  `channels.tvg_name` (both case- and whitespace-insensitive). Kodi labels follow what the
  channel is called in Kodi (`CNN`), not the raw M3U value (`US| CNN FHD`), so matching
  `tvg_name` alone matches nothing on typical data.
- Updates `channels.content_id` when it differs

### What it changes (and what it does not)

- Updates only `channels.content_id` (and `channels.updated_at`) for matched rows.
- Does **not** create/delete channels in Kodi or in the database.
- Does **not** change `stream_url`, `script_alias`, `active`, or any other CMS fields.

### Requirements

- Kodi must be reachable from the server running TanStack Start (usually your local dev machine on the same LAN).
- Set `KODI_URL` (preferred) or `KODI_HOST` + `KODI_PORT` in the environment profile you run with (typically `../env-profiles/local.env`).
- If nothing is set, it defaults to `http://localhost:8080/jsonrpc`.

Examples:

```bash
# Option A (preferred): full base URL (the app will append /jsonrpc if missing)
KODI_URL=http://192.168.86.44:8080

# Option B: host + port
KODI_HOST=192.168.86.44
KODI_PORT=8080

# Only if Kodi's web server requires authentication
KODI_USER=kodi
KODI_PASSWORD=changeme
```

Both env profiles must carry these values: `local.env` is what `pnpm dev` loads, and
`prod.env` is what `pnpm build:prod` and `srv/start.sh` load for the built runtime on
`:3100`. A value present in only one profile means `Sync Kodi` works in dev and fails
in the built app (or the reverse).

### Kodi setup (so JSON-RPC is reachable)

In Kodi, enable the web server / remote control so `http://<kodi-ip>:<port>/jsonrpc` is reachable:

- Settings → Services → Control:
  - enable remote control (same device / other systems as needed)
- Settings → Services → Web server:
  - enable “Allow remote control via HTTP”
  - note the configured port (often `8080`)

If Kodi’s web server has **Require authentication** enabled, set `KODI_USER` and `KODI_PASSWORD` in the same env profile and the sync sends an HTTP Basic `Authorization` header. Leave them blank when no auth is configured. A `401` from Kodi is reported with a message telling you which of the two cases applies.

### Limitations / troubleshooting

- Matching tries `name` then `tvg_name`. Set a channel’s `name` to exactly its Kodi label to make it match.
- Matching is exact aside from case and surrounding whitespace. If it can’t match, either adjust the channel `name` to match the Kodi label or set `content_id` manually in the channel edit form.
- When deployed (e.g. Vercel), the server likely cannot reach a home Kodi instance; run Sync Kodi from an environment that can reach Kodi, then store results in your DB.
- If `Sync Kodi` reports lots of “Skipped”, compare your DB `tvg_name` values with the channel labels shown in Kodi (PVR channel list). Those labels are what the sync matches against.

### Typical workflow

1. Import/seed channels from M3U (populates `tvg_name`).
2. For channels you want in Home Assistant:
   - set `active = true`
   - set `script_alias` (unique)
3. Populate `content_id`:
   - run `Sync Kodi` (recommended), or
   - enter `content_id` manually in the channel edit form.
4. Run `Export YAML` and add the output to Home Assistant.

### Direct YAML URL (`/channels/yaml`)

`GET /channels/yaml` runs a **Kodi sync first**, then returns the same YAML the
`Export YAML` button produces, as `text/yaml`. This is the YAML counterpart to
`/channels/m3u`: a URL that always reflects current Kodi content IDs, so Home
Assistant (or a `curl` in a cron job) can pull it without anyone clicking a button.

- Response starts with comment lines recording sync stats, the export count, and
  every skipped channel with its reason.
- If the Kodi sync fails the endpoint returns **HTTP 502** with the underlying
  error and serves no YAML — stale `content_id` values would silently produce a
  wrong playback mapping.

```bash
curl -sS http://127.0.0.1:3100/channels/yaml
```

## M3U Export System

M3U export is generated from the database (not from raw seed files) and always reflects current app state.

### Rules used by M3U export

- Exports only rows with `active = true`.
- Skips rows without `stream_url`.
- Uses `name || tvg_name` as the visible M3U label after the comma in `#EXTINF`.
- Keeps `tvg-name` as the original `tvg_name`.
- Resolves `group-title` from country first when `country_code` exists on channels:
  - `country_code` -> full English country name (for example `US` -> `United States`)
  - otherwise falls back to `COALESCE(group_titles.alias, group_titles.name)`
- Channels export uses table `channels`.
- Movies export uses table `media` with movie-only filtering:
  - `series_id IS NULL`
  - `media_type = 'movie'`

### UI export buttons

- `Channels` page `Export M3U` downloads `channels.m3u`.
- `Movies` page `Export M3U` downloads `movies.m3u`.

### Direct playlist URLs (for VLC / IPTV clients)

- `GET /channels/m3u` returns the live channel playlist as `audio/x-mpegurl`
- `GET /movies/m3u` returns the live movie playlist as `audio/x-mpegurl`
- `GET /channels/yaml` returns Home Assistant script YAML as `text/yaml` (syncs Kodi first)

These URLs always return what a current export would produce, so VLC can open them directly as network playlists.

## Navigation Overview

The landing page explains the same structure shown in the top navigation:

- `Home` - overview of the system and how channels, movies, series, Kodi sync, YAML export, and M3U feeds fit together
- `Channels` - manage live TV channels, filters, active/favourite state, exports, and Kodi sync
- `Channels M3U URL` - live active-channel playlist at `/channels/m3u` for VLC or other IPTV clients
- `Channels YAML` - Home Assistant script YAML at `/channels/yaml`, refreshed by a Kodi sync on every request
- `Add Channel` - create a new live TV channel record
- `Movies` - manage movie entries stored in `media` where `series_id IS NULL` and `media_type = 'movie'`
- `Movies M3U URL` - live active-movie playlist at `/movies/m3u`
- `Add Movie` - create a new movie record
- `Series` - manage series rows and their episode collections
- `Add Series` - create a new series record with episodes

## npm Scripts

### Database Commands

| Command | Description |
|---------|-------------|
| `pnpm db:push` | Push schema to local PostgreSQL |
| `pnpm db:push:prod` | Push schema to Supabase (no data change) |
| `pnpm db:generate` | Generate migration files |
| `pnpm db:migrate` | Run migrations locally |
| `pnpm db:studio` | Open Drizzle Studio (local) |
| `pnpm db:studio:prod` | Open Drizzle Studio (Supabase) |
| `pnpm db:seed:channels` | Seed channels from M3U (truncates first) |
| `pnpm db:seed:channels:prod` | Seed channels to Supabase (truncates first) |
| `pnpm db:seed:media` | Seed movies/series from M3U (truncates first) |
| `pnpm db:seed:media:prod` | Seed movies/series to Supabase (truncates first) |
| `pnpm db:psql` | Open psql shell (local) |
| `pnpm db:psql:prod` | Open psql shell (Supabase) |
| `pnpm db:reset` | Empty all tables without reseeding (rarely needed) |
| `pnpm db:reset:prod` | Empty Supabase tables (rarely needed) |

### Supabase CLI

| Command | Description |
|---------|-------------|
| `pnpm supabase <cmd>` | Run any Supabase CLI command |
| `pnpm sb:status` | Show table stats for linked project |

Examples:
```bash
pnpm supabase projects list
pnpm supabase inspect db table-stats --linked
pnpm supabase db dump --schema-only
```

### Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server with local database (port 3000) |
| `pnpm dev:prod` | Dev server with Supabase database |
| `pnpm build` | Production build |
| `pnpm preview` | Preview production build |
| `pnpm start` | Start production server |
| `pnpm test` | Run tests (vitest watch) |
| `pnpm test:run` | Run tests once |
| `pnpm ui:add` | Add shadcn component to packages/ui |

## Local vs Production Flow

### Schema Changes

1. Edit `src/db/schema.ts`
2. `pnpm db:push` — apply to local
3. Test locally
4. `pnpm db:push:prod` — apply to Supabase

**Schema pushes never affect data.** Local and production datasets are independent.

### Data Philosophy

- **Local**: Disposable dev data. Can be reset and reseeded anytime.
- **Production**: Source of truth. Real channel data from M3U import.

### Database Scripts - Usage Order

**Fresh start (new environment):**
```bash
pnpm db:push              # Create tables from schema
pnpm db:seed:channels     # Import TV channels from M3U
pnpm db:seed:media        # Import movies/series from M3U (optional)
```

**Schema changes:**
```bash
# Edit src/db/schema.ts
pnpm db:push              # Apply to local
# Test locally
pnpm db:push:prod         # Apply to production
```

**Replace data (just re-run seed):**
```bash
pnpm db:seed:channels     # Truncates channels table, then imports
pnpm db:seed:media        # Truncates media table, then imports
```

Each seed script truncates its own table before importing - no separate reset needed.

**M3U seeding notes:**
- Seed scripts expect M3U file at `../assets/seedchannels.m3u`
- `db:seed:channels` processes live TV (stops at first .mp4/.mkv)
- `db:seed:media` processes movies/series (.mp4/.mkv only)
- Uses staging table pattern: COPY raw data → INSERT DISTINCT group titles → INSERT with FK JOIN
- Group titles are shared: both seed scripts upsert into the same `group_titles` table

**Empty tables without reseeding (rarely needed):**
```bash
pnpm db:reset             # Truncate all tables, leave them empty
```

Use `db:reset` only if you want empty tables without importing new data.

## Monorepo Structure

This is a **pnpm workspace** monorepo:

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

### Packages

| Package | Purpose | Deployed? |
|---------|---------|-----------|
| `@iptvchannels/ui` | Shared UI components + Storybook | No (dev only) |

The main app (TanStack Start) lives at the root and is the only deployable.

## Prerequisites

- **Node.js** 18+
- **pnpm** 9+ (`npm install -g pnpm`)
- **PostgreSQL** 15 (Homebrew): `brew install postgresql@15`
- **Supabase CLI**: `brew install supabase/tap/supabase`

### Start Local PostgreSQL

```bash
brew services start postgresql@15
```

### Create Local Database

```bash
/opt/homebrew/opt/postgresql@15/bin/psql -U $(whoami) -d postgres -c "CREATE DATABASE iptvchannels;"
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Create environment files
cp ../env-profiles/.env.example ../env-profiles/local.env
# Edit local.env with your local Postgres URL

# Push schema to local database
pnpm db:push

# Seed with channel data (requires ../assets/seedchannels.m3u)
pnpm db:seed:channels

# Open Drizzle Studio
pnpm db:studio
```

## Security

**Never commit:**
- `../env-profiles/*.env`
- Any file containing database passwords or API tokens

The `.gitignore` is configured to exclude all sensitive files.
