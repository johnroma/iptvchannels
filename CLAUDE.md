# CLAUDE.md - Project Context for AI Assistants

## Project Overview

IPTV Channel Management system with:
- **Frontend**: TanStack Start (React meta-framework with SSR)
- **Backend**: Drizzle ORM + PostgreSQL
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Linting**: ESLint flat config + typescript-eslint
- **Local DB**: Homebrew PostgreSQL (not Docker)
- **Production DB**: Supabase
- **Deployment**: Vercel (planned)

## Directory Structure

```
iptvchannels/
├── src/
│   ├── db/              # Drizzle ORM (schema, validators, reset, client)
│   │   ├── schema.ts    # Table definitions (channels, media)
│   │   ├── validators.ts # Zod validation schemas (channelSchema, channelUpdateSchema)
│   │   ├── index.ts     # DB client + re-exports schema & validators
│   │   └── reset.ts     # Database reset script
│   ├── server/          # Server functions (createServerFn)
│   │   └── channels.ts  # All channel CRUD + export + sync operations
│   ├── components/      # App components
│   ├── lib/             # Utilities (m3u-export, yaml-export, m3u-parser)
│   ├── routes/          # TanStack Start file-based routes
│   │   ├── __root.tsx   # Root layout (document shell)
│   │   ├── index.tsx    # Home page
│   │   ├── channels.index.tsx  # Channel list (paginated, server-filtered)
│   │   ├── channels.$id.tsx    # Channel detail
│   │   ├── channels.new.tsx    # Create channel
│   │   └── edit/$id.tsx        # Edit channel
│   ├── router.tsx       # TanStack Router + React Query SSR + custom search serialization
│   └── routeTree.gen.ts # Auto-generated route tree
├── packages/ui/         # Shared UI components (shadcn/ui)
│   ├── components/      # shadcn components (button, input, card, select, switch, etc.)
│   ├── lib/utils.ts     # cn() helper function
│   ├── styles/globals.css  # Tailwind + CSS variables
│   └── components.json  # shadcn CLI config
├── env-profiles/        # Environment files (NOT .env.* at root)
│   ├── local.env        # Local PostgreSQL connection
│   ├── prod.env         # Supabase connection
│   ├── supabase.env     # Supabase CLI token
│   └── .env.example     # Template (only file committed)
├── scripts/             # Database seeding scripts (bash/awk)
│   ├── seed-channels.sh # Import TV channels from M3U
│   └── seed-media.sh    # Import movies/series from M3U
├── eslint.config.mjs    # ESLint flat config (typescript-eslint)
├── vite.config.ts
├── drizzle.config.ts
└── pnpm-workspace.yaml
```

## Path Aliases

```tsx
import { db } from "~/db"           // ~/  → ./src/*
import { cn } from "@/lib/utils"    // @/  → ./src/*
import { Button } from "@ui/components/button"  // @ui/ → ./packages/ui/*
```

## Tailwind CSS v4 Setup

Tailwind v4 uses the Vite plugin (no config file):

```ts
// vite.config.ts
plugins: [
  tsConfigPaths(),
  tanstackStart(),
  nitro(),
  viteReact(),
  tailwindcss(),  // @tailwindcss/vite plugin
]
```

## shadcn/ui Components

Components are in `packages/ui/`. To add new components:

```bash
pnpm ui:add  # or: cd packages/ui && pnpm dlx shadcn@latest add <component>
```

Import in app:
```tsx
import { Button } from "@ui/components/button"
```

## Critical TanStack Start Setup

**Required files (exactly 2):**
1. `src/router.tsx` - Router + React Query SSR integration
2. `src/routes/__root.tsx` - Root document shell

**NO app.tsx or ssr.tsx needed!**

### router.tsx with React Query SSR + Custom Search Serialization:
```tsx
import { QueryClient } from '@tanstack/react-query'
import { createRouter, parseSearchWith } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    // Custom serialization: arrays as repeated params (?countries=GR&countries=IR)
    stringifySearch: (search) => { /* URLSearchParams-based */ },
    parseSearch: parseSearchWith((value) => {
      try { return JSON.parse(value) } catch { return value }
    }),
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  // MUST be interface (not type) for module augmentation/declaration merging
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

### __root.tsx with React Query context:
```tsx
import { createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({ meta: [...], links: [...] }),
  component: RootComponent,
})
```

## Server Functions Pattern

Server functions live in `src/server/` and use `createServerFn` with Zod input validation:

```tsx
import { z } from "zod"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { db, channels } from "~/db"

// Paginated list with server-side filtering
const listChannelsSchema = z.object({
  cursor: z.number().optional().default(0),
  limit: z.number().optional().default(100),
  sortBy: z.enum(["name", "createdAt"]).optional().default("name"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("asc"),
  groupTitle: z.string().optional(),
  active: z.boolean().optional(),
  favourite: z.boolean().optional(),
  countries: z.array(z.string()).optional(),
})

export const listChannels = createServerFn({ method: "GET" })
  .inputValidator(listChannelsSchema)
  .handler(async ({ data: { cursor, limit, ... } }) => {
    // Build WHERE clause from filters, fetch with pagination
    return { data: result, totalCount }
  })

// Get by ID (UUID string)
export const getChannelById = createServerFn({ method: "GET" })
  .inputValidator((data: string) => typeof data === "string" ? data : null)
  .handler(async ({ data }) => {
    if (data === null) return null
    return db.query.channels.findFirst({
      where: eq(channels.id, data),
    })
  })
```

**Important**: Always import `eq` directly from `drizzle-orm` and the table from schema. Don't use the callback destructuring pattern.

## Data Fetching Patterns

### Server-Side Filtering & Pagination

All channel filtering (active, favourite, countries, groupTitle) is done server-side. The frontend passes filter params to `channelsQueryOptions` which constructs the query key and calls `listChannels`:

```tsx
export const channelsQueryOptions = (
  page: number, sortBy, sortDirection, groupTitle?, active?, favourite?, countries?
) => queryOptions({
  queryKey: ["channels", page, sortBy, sortDirection, groupTitle, active, favourite, countries],
  queryFn: () => listChannels({ data: { cursor: (page - 1) * 100, ... } }),
})
```

### Route with loaderDeps + Server-Side Filters

```tsx
export const Route = createFileRoute("/channels/")({
  validateSearch: (search) => channelsSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ page: search.page, groupTitle: search.groupTitle, ... }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(channelsQueryOptions(deps.page, "name", ...)),
      context.queryClient.ensureQueryData(groupTitlesQueryOptions),
      context.queryClient.ensureQueryData(countryCodesQueryOptions),
    ])
  },
})
```

### Query Strategy

- **Static lookup data** (group titles, country codes): `useSuspenseQuery` + loader prefetch
- **Paginated channel list**: `useQuery` + `keepPreviousData` (shows stale data while page transitions)
- **Mutations** (toggle active): optimistic update via `setQueriesData` + `invalidateQueries` on settle

## Validation Schemas

Located at `src/db/validators.ts` (NOT `schema.ts`):
- `channelSchema` — Zod schema for creating channels (derived from Drizzle schema via `drizzle-zod`)
- `channelUpdateSchema` — Extends `channelSchema` with required `id: z.uuid()`
- `COUNTRY_CODES` — ISO 3166-1 Alpha-2 country code const array
- `CountryCode` — TypeScript type derived from `COUNTRY_CODES`

## Database Schema

Located at `src/db/schema.ts`:
- `channels` table: Live TV channels (id:uuid, tvgId, tvgName, tvgLogo, groupTitle, streamUrl, contentId, name, countryCode, favourite, active, scriptAlias, timestamps)
- `media` table: Movies/series (id:uuid, tvgId, tvgName, tvgLogo, groupTitle, streamUrl, mediaType, year, season, episode, name, favourite, active, timestamps)

## ESLint Configuration

ESLint flat config at `eslint.config.mjs` with `typescript-eslint`:
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/no-unused-vars`: error (ignores `_` prefixed args)
- `@typescript-eslint/consistent-type-definitions`: error, prefer `type` over `interface`

**Exception**: TanStack Router's `Register` declaration MUST use `interface` for module augmentation. Use `// eslint-disable-next-line` there.

## NPM Scripts

```bash
# Development
pnpm dev              # Run with local.env (kills existing port 3000 first)
pnpm dev:prod         # Run with prod.env (Supabase data)
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm start            # Start production server
pnpm test             # Run tests (vitest watch)
pnpm test:run         # Run tests once

# UI components
pnpm ui:add           # Add shadcn component to packages/ui

# Database schema
pnpm db:push          # Push schema to local DB
pnpm db:push:prod     # Push schema to Supabase
pnpm db:migrate       # Run migrations (local)
pnpm db:migrate:prod  # Run migrations (Supabase)
pnpm db:studio        # Drizzle Studio (local)
pnpm db:studio:prod   # Drizzle Studio (Supabase)

# Database seeding (truncates table first, then imports via PostgreSQL COPY)
pnpm db:seed:channels      # Import TV channels from M3U (local)
pnpm db:seed:channels:prod # Import TV channels from M3U (Supabase)
pnpm db:seed:media         # Import movies/series from M3U (local)
pnpm db:seed:media:prod    # Import movies/series from M3U (Supabase)

# Empty tables without reseeding (rarely needed - seed already truncates)
pnpm db:reset              # Truncate all tables, leave empty
pnpm db:reset:prod         # Truncate Supabase tables (careful!)

# Database utilities
pnpm db:psql          # Connect to local DB via psql
pnpm db:psql:prod     # Connect to Supabase via psql

# Supabase CLI
pnpm supabase <cmd>   # Run Supabase CLI with token from supabase.env
pnpm sb:status        # Check Supabase table stats
```

Note: `pnpm dev` runs `predev` first which kills any process on port 3000, and uses `--strictPort` to fail if port is still busy.

## Key Patterns

1. **Environment switching**: Use `dotenv -e env-profiles/<profile>.env --` prefix
2. **Local = disposable**: Local DB can be reset. Production is source of truth.
3. **Supabase CLI**: Always use `pnpm supabase` to ensure token is loaded
4. **No Docker**: Uses local Homebrew PostgreSQL (`john@localhost:5432/iptvchannels`)
5. **Server-side filtering**: Active, favourite, countries, groupTitle are all server-side WHERE clauses — not client-side filters
6. **Page-based pagination**: Uses `cursor` offset with page numbers, not infinite scroll

## Common Mistakes to Avoid

1. Do NOT create `app.tsx` - TanStack Start doesn't need it
2. Do NOT import HeadContent/Scripts from `@tanstack/react-start` - they're in `@tanstack/react-router`
3. Do NOT put .env files at root - use `env-profiles/` directory
4. Do NOT use Docker for local DB - use Homebrew PostgreSQL
5. Do NOT use `eq` from callback destructuring in Drizzle - import directly from `drizzle-orm`
6. Do NOT run multiple vite dev servers - `predev` script handles this automatically
7. Do NOT add shadcn components from wrong directory - must be in `packages/ui/`
8. Do NOT use `type` for TanStack Router's `Register` declaration - must be `interface` for module augmentation (add eslint-disable comment)
9. Do NOT filter channels client-side for active/favourite/countries/group - these are server-side filters passed to `listChannels`

## GitHub Repository

https://github.com/johnroma/iptvchannels
