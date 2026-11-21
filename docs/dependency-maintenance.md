# Dependency maintenance

Run `pnpm verify:maintenance` from an isolated sibling worktree. It uses the
pinned pnpm 10.33.0, a clean environment, a frozen strict-peer install, all unit
regressions, zero-warning ESLint, both TypeScript projects and a node-server build
whose output stays inside the checkout. Never use dev hooks, real dotenv files,
database/Kodi operations or shared `srv/` as a dependency-verification shortcut.

Use npm-check-updates for the root and `packages/ui/package.json`. Keep affected
release versions and the owning lockfile in sync. The current maintenance release
is root 1.0.1 / UI 0.0.2. Follow `/home/john/projects/STRUCTURE.md` for SemVer and
John's no-PR exception for verified dependency maintenance and necessary narrow
compatibility repairs. Preserve and track legitimate instruction files; don't
ignore, discard or silently overwrite unrelated work.

## Compatibility constraints and revisit conditions

- TypeScript 6.0.3 is the highest currently supported stable release in the
  typescript-eslint 8.73 peer range (`>=4.8.4 <6.1.0`). Raw latest TS7 is not
  compatible. `.ncurc.cjs` keeps patch updates within the supported 6.0 series.
  Re-evaluate the parser's actual peer range on every maintenance run; advance
  this constraint when support expands and the full gate passes.
- The existing Nitro 3 beta is deliberately retained instead of automatically
  adopting another prerelease. Revisit when a stable supported Nitro release or
  an evidence-backed required migration is available. Never override conflicting
  peers or weaken build/release-age security policy.
- Package-manager updates are a separate toolchain decision; keep pnpm 10.33.0.
- Vite 8 resolves TypeScript paths through `resolve.tsconfigPaths: true`. The old
  vite-tsconfig-paths/tsconfck chain and deprecated baseUrl are retired. Current
  TanStack server functions use `.validator()`, not the removed inputValidator
  chain. Keep active guidance and regressions aligned with these supported APIs.

For native-bundler anomalies, check the native binding resolved from the bundler's
actual entry point, not an unrelated parent-visible package. Check a clean frozen
install before blaming a Vite release or downgrading it.

## Vercel and local production are distinct

A push to authoritative `main` is production-deploying through the existing
Vercel Git integration. `vercel.json` builds with `NITRO_PRESET=vercel`; validate
that preset in isolation as well as the local node-server build. Obtain applicable
production-deployment authorization before landing, and verify the exact commit's
Vercel deployment/check status afterward. Do not disable Vercel settings or claim a
local build proves the cloud deployment succeeded.

The VM's service serves a separate wrapper `srv/` runtime. Updating source or a
Vercel deployment does not update that local runtime. Do not restart/rebuild it
without its own authorization; preserve its actual provenance and timestamps.
