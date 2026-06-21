export function buildStreamUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  const base = process.env.STREAM_BASE_PATH
  const port = process.env.STREAM_BASE_PORT
  if (!base) return path
  const baseWithPort = port ? `${base}:${port}` : base
  return `${baseWithPort.replace(/\/$/, "")}/${path}`
}

export function stripStreamBase(url: string | null | undefined): string | null {
  if (!url) return null
  return url.replace(/^https?:\/\/[^/]+\//, "")
}
