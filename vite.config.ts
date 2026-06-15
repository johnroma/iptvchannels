import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"
import tsConfigPaths from "vite-tsconfig-paths"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import tailwindcss from "@tailwindcss/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"

const host = process.env.HOST || "127.0.0.1"
const port = Number(process.env.PORT || 3000)

// Allow production builds to emit Nitro's `.output` outside the repo root
// (for this workspace, into ../srv/.output) so the built runtime stays
// separate from the editable Git checkout.
const __dirname = dirname(fileURLToPath(import.meta.url))
const nitroOutputDir = process.env.NITRO_OUTPUT_DIR
  ? resolve(__dirname, process.env.NITRO_OUTPUT_DIR)
  : undefined

// Nitro 3's dev middleware ASSET_EXT_RE doesn't include `json`, so JSON module
// requests (*.json?import) get routed to Nitro's SSR worker and 404. Patching
// sec-fetch-dest to "script" before Nitro's middleware sees the request causes
// it to treat the file as a Vite asset and pass it through to Vite instead.
const fixJsonDevServe: Plugin = {
  name: "fix-json-dev-serve",
  enforce: "pre",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (/\.json[?#]/.test(req.url ?? "")) {
        req.headers["sec-fetch-dest"] = "script"
      }
      next()
    })
  },
}

export default defineConfig({
  server: {
    host,
    port,
  },
  plugins: [
    fixJsonDevServe,
    tsConfigPaths({
      projects: ["./tsconfig.json", "./packages/ui/tsconfig.json"],
    }),
    tanstackStart(),
    nitro(nitroOutputDir ? { output: { dir: nitroOutputDir } } : {}),
    viteReact(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      external: ["postgres"],
    },
  },
})
