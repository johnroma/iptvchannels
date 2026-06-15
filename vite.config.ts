import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
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

export default defineConfig({
  server: {
    host,
    port,
  },
  plugins: [
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
