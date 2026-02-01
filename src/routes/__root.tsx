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
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary"
import { NotFound } from "~/components/NotFound"
import globalCss from "@ui/styles/globals.css?url"

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
          <nav className="mb-4">
            <a
              href="/"
              className="text-blue-600"
            >
              Home
            </a>
            <span className="mx-2">|</span>
            <a
              href="/channels"
              className="text-blue-600"
            >
              Channels
            </a>
            <span className="mx-2">|</span>
            <a
              href="/channels/new"
              className="text-blue-600"
            >
              Add Channel
            </a>
            <span className="mx-2">|</span>
            <a
              href="/media"
              className="text-blue-600"
            >
              Media
            </a>
            <span className="mx-2">|</span>
            <a
              href="/media/new"
              className="text-blue-600"
            >
              Add Media
            </a>
          </nav>
          <h1 className="text-3xl font-bold">IPTV Channels Management</h1>
        </header>
        <main className="m-10">{children}</main>
        <TanStackRouterDevtools position="bottom-right" />
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </body>
    </html>
  )
}
