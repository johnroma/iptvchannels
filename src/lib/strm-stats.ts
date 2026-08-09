/**
 * Parse the stdout of strm-bridge's generate.py into structured stats.
 *
 * Expected output lines:
 *   fetched 34 active media rows -> 34 .strm files
 *   written=34 unchanged=0 removed=0
 */

export type StrmStats = {
  fetched: number
  files: number
  written: number
  unchanged: number
  removed: number
}

export function parseStrmStats(output: string): StrmStats | null {
  const fetched = /fetched (\d+) active media rows -> (\d+) \.strm files/.exec(
    output,
  )
  const counts = /written=(\d+) unchanged=(\d+) removed=(\d+)/.exec(output)
  if (!fetched || !counts) return null
  return {
    fetched: Number(fetched[1]),
    files: Number(fetched[2]),
    written: Number(counts[1]),
    unchanged: Number(counts[2]),
    removed: Number(counts[3]),
  }
}
