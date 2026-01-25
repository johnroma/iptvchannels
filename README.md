# IPTV Channels

Channel management system for IPTV with Home Assistant and Kodi integration.

**Stack:** TanStack Start + Drizzle ORM + PostgreSQL/Supabase + Tailwind CSS v4 + shadcn/ui

## Project Structure

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
│   │   ├── schema.ts           # Database schema (channels, media)
│   │   ├── validators.ts       # Zod validation schemas
│   │   ├── index.ts            # Database client + re-exports
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
├── env-profiles/               # Environment configurations
│   ├── local.env               # Local PostgreSQL
│   ├── prod.env                # Supabase production
│   ├── supabase.env            # Supabase CLI token
│   └── .env.example            # Template (safe to commit)
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

Environment files are stored in `env-profiles/` and are **not committed to git** (except `.env.example`).

### Create Environment Files

```bash
cp env-profiles/.env.example env-profiles/local.env
cp env-profiles/.env.example env-profiles/prod.env
cp env-profiles/.env.example env-profiles/supabase.env
```

### Environment Profiles

| File | Purpose | Variables |
|------|---------|-----------|
| `local.env` | Local development | `DATABASE_URL` (Homebrew Postgres) |
| `prod.env` | Supabase production | `DATABASE_URL` (Supabase pooler) |
| `supabase.env` | Supabase CLI | `SUPABASE_ACCESS_TOKEN` |

### Vercel Deployment

Set `DATABASE_URL` in Vercel environment variables to the Supabase connection string.

## Database Schema

The `channels` table stores IPTV channel data:

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `id` | uuid | auto | Primary key (random UUID) |
| `tvg_id` | text | M3U | EPG identifier |
| `tvg_name` | text | M3U | Channel name (e.g., "US\| ABC HD") |
| `tvg_logo` | text | M3U | Logo URL |
| `group_title` | text | M3U | Category (e.g., "US\| ENTERTAINMENT") |
| `stream_url` | text | M3U | Stream URL |
| `content_id` | integer | Kodi | Kodi channel ID for playback |
| `name` | text | CMS | Custom display name |
| `country_code` | text | CMS | Country code (e.g., "US", "UK") |
| `favourite` | boolean | CMS | Mark as favourite |
| `active` | boolean | CMS | Include in YAML export |
| `script_alias` | text | CMS | Home Assistant script alias |
| `created_at` | timestamp | auto | Created timestamp |
| `updated_at` | timestamp | auto | Updated timestamp |

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
- Uses PostgreSQL COPY for fast bulk import

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
cp env-profiles/.env.example env-profiles/local.env
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
- `env-profiles/*.env` (except `.env.example`)
- Any file containing database passwords or API tokens

The `.gitignore` is configured to exclude all sensitive files.
