import { defineConfig } from "vite"
import tsConfigPaths from "vite-tsconfig-paths"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import tailwindcss from "@tailwindcss/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 3000,
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json", "./packages/ui/tsconfig.json"],
    }),
    tanstackStart(),
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      external: ["postgres"],
    },
  },
})
