# CLAUDE.md - Project Context for AI Assistants

## Project Overview

IPTV Channel Management system with:
- **Frontend**: TanStack Start (React meta-framework with SSR)
- **Backend**: Drizzle ORM + PostgreSQL
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Local DB**: Homebrew PostgreSQL (not Docker)
- **Production DB**: Supabase
- **Deployment**: Vercel (planned)

## Directory Structure

```
iptvchannels/
├── src/
│   ├── db/              # Drizzle ORM (schema, reset, client)
│   ├── server/          # Server functions (createServerFn)
│   ├── components/      # App components
│   ├── routes/          # TanStack Start file-based routes
│   │   ├── __root.tsx   # Root layout (document shell)
│   │   ├── index.tsx    # Home page
│   │   ├── channels.index.tsx  # Channel list
│   │   └── channels.$id.tsx    # Channel detail
│   ├── styles/          # CSS files (Tailwind)
│   ├── router.tsx       # TanStack Router + React Query setup
│   └── routeTree.gen.ts # Auto-generated route tree
├── packages/ui/         # Shared UI components (shadcn/ui)
│   ├── components/      # shadcn components (button, input, card, etc.)
│   ├── lib/utils.ts     # cn() helper function
│   ├── hooks/           # Shared hooks
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
  viteReact(),
  tailwindcss(),  // @tailwindcss/vite plugin
]
```

```css
/* src/styles/app.css */
@import 'tailwindcss';
```

## shadcn/ui Components

Components are in `packages/ui/`. To add new components:

```bash
cd packages/ui
pnpm dlx shadcn@latest add button
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

### router.tsx with React Query SSR:
```tsx
import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })  // Provides QueryClientProvider!
  return router
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

Server functions live in `src/server/` and use `createServerFn`:

```tsx
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { db } from "~/db"
import { channels } from "~/db/schema"

// List with selected columns for performance
export const listChannels = createServerFn({ method: "GET" }).handler(
  async () => {
    return db.query.channels.findMany({
      columns: { id: true, tvgName: true },
    })
  }
)

// Get by ID with validation
export const getChannelById = createServerFn({ method: "GET" })
  .inputValidator(({ id }) => {
    if (typeof id === "number" && !Number.isNaN(id)) return id
    return null
  })
  .handler(async ({ data }) => {
    if (data === null) return null
    return db.query.channels.findFirst({
      where: eq(channels.id, data),  // Use direct eq import!
    })
  })
```

**Important**: Always import `eq` directly from `drizzle-orm` and the table from schema. Don't use the callback destructuring pattern.

## NPM Scripts

```bash
# Development
pnpm dev              # Run with local.env (kills existing port 3000 first)
pnpm dev:prod         # Run with prod.env (Supabase data)

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

## Database Schema

Located at `src/db/schema.ts`:
- `channels` table: Live TV channels (tvgId, tvgName, tvgLogo, groupTitle, streamUrl, contentId, name, countryCode, favourite, active, scriptAlias, timestamps)
- `media` table: Movies/series (tvgId, tvgName, tvgLogo, groupTitle, streamUrl, mediaType, year, season, episode, name, favourite, active, timestamps)

Validation schemas use Zod (see `src/db/schema.ts` for `channelInputSchema`).

## Key Patterns

1. **Environment switching**: Use `dotenv -e env-profiles/<profile>.env --` prefix
2. **Local = disposable**: Local DB can be reset. Production is source of truth.
3. **Supabase CLI**: Always use `pnpm supabase` to ensure token is loaded
4. **No Docker**: Uses local Homebrew PostgreSQL (`john@localhost:5432/iptvchannels`)

## Common Mistakes to Avoid

1. Do NOT create `app.tsx` - TanStack Start doesn't need it
2. Do NOT import HeadContent/Scripts from `@tanstack/react-start` - they're in `@tanstack/react-router`
3. Do NOT put .env files at root - use `env-profiles/` directory
4. Do NOT use Docker for local DB - use Homebrew PostgreSQL
5. Do NOT use `eq` from callback destructuring in Drizzle - import directly from `drizzle-orm`
6. Do NOT run multiple vite dev servers - `predev` script handles this automatically
7. Do NOT add shadcn components from wrong directory - must be in `packages/ui/`

## GitHub Repository

https://github.com/johnroma/iptvchannels
