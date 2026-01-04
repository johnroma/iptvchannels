# CLAUDE.md - Project Context for AI Assistants

## Project Overview

IPTV Channel Management system with:
- **Frontend**: TanStack Start (React meta-framework with SSR)
- **Backend**: Drizzle ORM + PostgreSQL
- **Local DB**: Homebrew PostgreSQL (not Docker)
- **Production DB**: Supabase
- **Deployment**: Vercel (planned)

## Directory Structure

```
iptvchannels/
├── src/
│   ├── db/              # Drizzle ORM (schema, seed, client)
│   ├── routes/          # TanStack Start file-based routes
│   │   ├── __root.tsx   # Root layout (document shell)
│   │   └── index.tsx    # Home page
│   ├── styles/          # CSS files
│   ├── router.tsx       # TanStack Router configuration
│   └── routeTree.gen.ts # Auto-generated route tree
├── env-profiles/        # Environment files (NOT .env.* at root)
│   ├── local.env        # Local PostgreSQL connection
│   ├── prod.env         # Supabase connection
│   ├── supabase.env     # Supabase CLI token
│   └── .env.example     # Template (only file committed)
├── packages/ui/         # Storybook components (dev only, never deployed)
├── vite.config.ts
├── drizzle.config.ts
└── pnpm-workspace.yaml
```

## Critical TanStack Start Setup

**Required files (exactly 2):**
1. `src/router.tsx` - Router configuration
2. `src/routes/__root.tsx` - Root document shell

**NO app.tsx or ssr.tsx needed!**

### __root.tsx Must Have:
```tsx
/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'  // ALL from react-router, NOT react-start!

export const Route = createRootRoute({
  head: () => ({ meta: [...], links: [...] }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

### vite.config.ts Order Matters:
```ts
plugins: [
  tsConfigPaths(),
  tanstackStart(),  // Start plugin FIRST
  viteReact(),      // React plugin AFTER start
]
```

## NPM Scripts

```bash
# Development
pnpm dev              # Run with local.env
pnpm dev:prod         # Run with prod.env (Supabase data)

# Database
pnpm db:push          # Push schema to local DB
pnpm db:push:prod     # Push schema to Supabase
pnpm db:studio        # Drizzle Studio (local)
pnpm db:studio:prod   # Drizzle Studio (Supabase)
pnpm db:seed          # Seed local DB (mock data only)

# Supabase CLI
pnpm supabase <cmd>   # Run Supabase CLI with token from supabase.env
pnpm sb:status        # Check Supabase table stats
```

## Database Schema

Located at `src/db/schema.ts`:
- `channels` table with: tvgId, tvgName, tvgLogo, groupTitle, streamUrl, contentId, name, countryCode, favourite, active, scriptAlias, timestamps

## Key Patterns

1. **Environment switching**: Use `dotenv -e env-profiles/<profile>.env --` prefix
2. **Local = disposable**: Local seed creates 1 mock row. Production is source of truth.
3. **Supabase CLI**: Always use `pnpm supabase` to ensure token is loaded
4. **No Docker**: Uses local Homebrew PostgreSQL (`john@localhost:5432/iptvchannels`)

## Common Mistakes to Avoid

1. Do NOT create `app.tsx` - TanStack Start doesn't need it
2. Do NOT import HeadContent/Scripts from `@tanstack/react-start` - they're in `@tanstack/react-router`
3. Do NOT put .env files at root - use `env-profiles/` directory
4. Do NOT use Docker for local DB - use Homebrew PostgreSQL
5. Do NOT seed production from local files - production has its own data

## GitHub Repository

https://github.com/johnroma/iptvchannels
