import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { createServerFn } from "@tanstack/react-start"
import { parseStrmStats, type StrmStats } from "~/lib/strm-stats"

const execFileAsync = promisify(execFile)

// The strm-bridge generator that turns active media rows into the .strm library
// shared over Samba. Runs on demand here ("push") in addition to its 15-min
// systemd timer ("pull").
const STRM_SCRIPT =
  process.env.STRM_BRIDGE_SCRIPT ??
  "/home/john/projects/strm-bridge.workspace/strm-bridge/generate.py"

export type PublishStrmResult =
  | { ok: true; stats: StrmStats | null; output: string }
  | { ok: false; message: string }

export const publishStrmLibrary = createServerFn({ method: "POST" }).handler(
  async (): Promise<PublishStrmResult> => {
    try {
      const { stdout, stderr } = await execFileAsync(
        "python3",
        [STRM_SCRIPT],
        {
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024,
          env: {
            ...process.env,
            POSTGREST_URL:
              process.env.POSTGREST_URL ?? "http://127.0.0.1:3110",
          },
        },
      )
      return { ok: true, stats: parseStrmStats(stdout), output: stdout + stderr }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown STRM publish error"
      return { ok: false, message }
    }
  },
)
