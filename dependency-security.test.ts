import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// Vercel blocks older Start releases for CVE-2026-102989 before running builds.
// Keep the manifest's lower bound patched, not just one lucky lockfile resolution.
describe("deployment dependency security", () => {
  it("requires the TanStack Start XSS fix or newer", () => {
    const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
    const range = manifest.dependencies["@tanstack/react-start"] as string
    expect(range).toMatch(/^\^?\d+\.\d+\.\d+$/)
    const lowerBound = range.replace(/^\^/, "")
    expect(lowerBound.localeCompare("1.168.60", "en", { numeric: true })).toBeGreaterThanOrEqual(0)
  })
})
