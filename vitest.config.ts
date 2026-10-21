import { defineConfig } from "vitest/config"
import tsConfigPaths from "vite-tsconfig-paths"

// Unit tests need workspace aliases, not the app's Start/Nitro server plugins.
export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json", "./packages/ui/tsconfig.json"],
    }),
  ],
})
