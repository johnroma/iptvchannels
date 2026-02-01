import { QueryClient } from "@tanstack/react-query"
import { createRouter, parseSearchWith } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { routeTree } from "./routeTree.gen"
import { DefaultCatchBoundary } from "./components/DefaultCatchBoundary"
import { NotFound } from "./components/NotFound"

export function getRouter() {
  const queryClient = new QueryClient()

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    // Custom serialization: arrays as repeated params (?key=val1&key=val2)
    stringifySearch: (search) => {
      const params = new URLSearchParams()

      for (const [key, value] of Object.entries(search)) {
        if (value === undefined) continue

        // Arrays: repeat the parameter name
        if (Array.isArray(value)) {
          value.forEach((item) => params.append(key, String(item)))
        }
        // Objects: JSON stringify
        else if (typeof value === "object" && value !== null) {
          params.set(key, JSON.stringify(value))
        }
        // Primitives: as-is
        else {
          params.set(key, String(value))
        }
      }

      const result = params.toString()
      return result ? `?${result}` : ""
    },
    parseSearch: parseSearchWith((value) => {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }),
  })
  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  })

  return router
}

declare module "@tanstack/react-router" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
