# IPTV Channels

Channel management system for IPTV with Home Assistant integration.

**Stack:** TanStack Start + Drizzle ORM + PostgreSQL/Supabase

## Project Structure

```
iptvchannels/
├── src/
│   ├── routes/                 # TanStack Start file-based routing
│   │   ├── __root.tsx          # Document shell (<html>, <body>)
│   │   ├── index.tsx           # Home page
│   │   └── channels/           # Channel management routes
│   ├── components/             # App-specific components
│   ├── db/                     # Drizzle schema & client
│   │   ├── schema.ts           # Database schema definition
│   │   ├── index.ts            # Database client export
│   │   └── seed.ts             # Local dev seed script
│   ├── lib/                    # Shared utilities
│   ├── router.tsx              # Router configuration
│   ├── routeTree.gen.ts        # Auto-generated route tree
│   └── styles.css              # Global styles
├── packages/
│   └── ui/                     # Shared UI components (dev only)
│       ├── src/components/     # Reusable UI primitives
│       ├── stories/            # Storybook stories
│       └── package.json
├── env-profiles/               # Environment configurations
│   ├── local.env               # Local PostgreSQL
│   ├── prod.env                # Supabase production
│   ├── supabase.env            # Supabase CLI token
│   └── .env.example            # Template (safe to commit)
├── supabase/
│   ├── config.toml             # Supabase project config
│   └── migrations/             # Drizzle-generated migrations
├── drizzle.config.ts           # Drizzle Kit configuration
├── app.config.ts               # TanStack Start configuration
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
| `id` | serial | auto | Primary key |
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
| `pnpm db:seed` | Seed local with 1 mock row |
| `pnpm db:psql` | Open psql shell (local) |
| `pnpm db:psql:prod` | Open psql shell (Supabase) |

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

### Development (coming soon)

| Command | Description |
|---------|-------------|
| `pnpm dev` | TanStack Start dev server |
| `pnpm dev:local` | Dev with local database |
| `pnpm dev:prod` | Dev with Supabase database |
| `pnpm storybook` | Storybook dev server (port 6006) |
| `pnpm build` | Production build |

## Local vs Production Flow

### Schema Changes

1. Edit `src/db/schema.ts`
2. `pnpm db:push` — apply to local
3. Test locally
4. `pnpm db:push:prod` — apply to Supabase

**Schema pushes never affect data.** Local and production datasets are independent.

### Data Philosophy

- **Local**: Disposable dev data. `pnpm db:seed` creates 1 mock row.
- **Production**: Source of truth. Real channel data from M3U/contentid import.

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

# Seed with mock data
pnpm db:seed

# Open Drizzle Studio
pnpm db:studio
```

## Security

**Never commit:**
- `env-profiles/*.env` (except `.env.example`)
- Any file containing database passwords or API tokens

The `.gitignore` is configured to exclude all sensitive files.
