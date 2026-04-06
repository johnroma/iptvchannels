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
│   │   └── edit/$id.tsx        # Edit channel
│   ├── components/             # App-specific components
│   ├── server/                 # Server functions (createServerFn)
│   ├── db/                     # Drizzle schema & client
│   │   ├── schema.ts           # Database schema (group_titles, channels, media) + relations
│   │   ├── validators.ts       # Zod validation schemas
│   │   ├── index.ts            # Lazy-init DB client (Proxy) + re-exports
│   │   └── reset.ts            # Database reset script
│   ├── lib/                    # Shared utilities (m3u-export, yaml-export, m3u-parser)
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
│   ├── seed-channels.sh        # M3U channel seeder (bash/awk)
│   └── seed-media.sh           # M3U media seeder (bash/awk)
├── supabase/
│   ├── config.toml             # Supabase project config
│   └── migrations/             # Drizzle-generated migrations
├── eslint.config.mjs           # ESLint flat config (typescript-eslint)
├── drizzle.config.ts           # Drizzle Kit configuration
├── vite.config.ts              # Vite + TanStack Start + Tailwind + Nitro
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
| `../env-profiles/local.env` | Local development | `DATABASE_URL` (Homebrew Postgres), `KODI_URL` (preferred) or `KODI_HOST` + `KODI_PORT` |
| `../env-profiles/prod.env` | Supabase production | `DATABASE_URL` (Supabase pooler) |
| `../env-profiles/supabase.env` | Supabase CLI | `SUPABASE_ACCESS_TOKEN` |

### Vercel Deployment

Set `DATABASE_URL` in Vercel environment variables to the Supabase connection string.

## Database Schema

### `group_titles` — Normalized lookup table

Shared by `channels` and `media`. Changing an alias here updates it for all linked rows.

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

## Export YAML (Home Assistant)

This project does **not** call Home Assistant directly. Instead, it generates YAML you paste into Home Assistant (or include from a package) so Home Assistant can call *your* existing playback automation.

- `Export YAML` generates Home Assistant `script:` entries.
- Each exported channel becomes a script keyed by `channels.script_alias`.
- The generated script calls `service: script.play_channel` and passes:
  - `content_id` (Kodi PVR `channelid`, stored in `channels.content_id`)
  - `channel_title` (from `channels.tvg_name`)
  - `channel_thumbnail` (from `channels.tvg_logo`)

Important: you must already have a `script.play_channel` in Home Assistant (or adapt the generator to call a different service). This repo only generates the per-channel wrappers.

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
- Matches each DB channel by `channels.tvg_name` (case-insensitive) against the Kodi label
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
```

### Kodi setup (so JSON-RPC is reachable)

In Kodi, enable the web server / remote control so `http://<kodi-ip>:<port>/jsonrpc` is reachable:

- Settings → Services → Control:
  - enable remote control (same device / other systems as needed)
- Settings → Services → Web server:
  - enable “Allow remote control via HTTP”
  - note the configured port (often `8080`)

This implementation currently assumes **no HTTP auth** on the JSON-RPC endpoint. If you configured a username/password in Kodi’s web server settings, `Sync Kodi` will fail until the code is extended to send credentials.

### Limitations / troubleshooting

- Matching is by `tvg_name` only (not the editable `name` field). If you renamed channels inside Kodi, they may not match.
- Matching is exact aside from case. If it can’t match, either adjust the M3U/Kodi channel name or set `content_id` manually in the channel edit form.
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

## M3U Export System

M3U export is generated from the database (not from raw seed files) and always reflects current app state.

### Rules used by M3U export

- Exports only rows with `active = true`.
- Skips rows without `stream_url`.
- Resolves `group-title` from `COALESCE(group_titles.alias, group_titles.name)`.
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

These URLs always return what a current export would produce, so VLC can open them directly as network playlists.

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
