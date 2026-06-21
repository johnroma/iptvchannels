/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import * as React from "react"
import type { QueryClient } from "@tanstack/react-query"
import {
  Clapperboard,
  Film,
  Home as HomeIcon,
  Plus,
  Rss,
  Tv,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary"
import { NotFound } from "~/components/NotFound"
import globalCss from "@ui/styles/globals.css?url"

type NavItem = { href: string; label: string; icon: LucideIcon }

// Grouped by content type: list → add → feed
const navGroups: NavItem[][] = [
  [{ href: "/", label: "Home", icon: HomeIcon }],
  [
    { href: "/channels", label: "Channels", icon: Tv },
    { href: "/channels/new", label: "Add Channel", icon: Plus },
    { href: "/channels/m3u", label: "Channels Feed", icon: Rss },
  ],
  [
    { href: "/movies", label: "Movies", icon: Film },
    { href: "/movies/new", label: "Add Movie", icon: Plus },
    { href: "/movies/m3u", label: "Movies Feed", icon: Rss },
  ],
  [
    { href: "/series", label: "Series", icon: Clapperboard },
    { href: "/series/new", label: "Add Series", icon: Plus },
  ],
]

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
    ],
    links: [{ rel: "stylesheet", href: globalCss }],
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    )
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="m-10">
          <nav className="mb-6 flex flex-wrap items-center gap-1">
            {navGroups.map((group, groupIndex) => (
              <React.Fragment key={groupIndex}>
                {groupIndex > 0 && (
                  <span
                    aria-hidden
                    className="mx-1 h-5 w-px bg-border"
                  />
                )}
                {group.map(({ href, label, icon: Icon }) => (
                  <a
                    key={href}
                    href={href}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Icon className="size-4" />
                    {label}
                  </a>
                ))}
              </React.Fragment>
            ))}
          </nav>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Tv className="size-7 text-primary" />
            IPTV Channels Management
          </h1>
        </header>
        <main className="m-10">{children}</main>
        <TanStackRouterDevtools position="bottom-right" />
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </body>
    </html>
  )
}
