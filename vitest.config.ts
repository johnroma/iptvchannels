import { defineConfig } from "vitest/config"

// Unit tests need workspace aliases, not the app's Start/Nitro server plugins.
export default defineConfig({
  resolve: { tsconfigPaths: true },
})
