import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { ListStream, type Stream } from "./ListStream"

vi.mock("./ActiveSwitch", () => ({ ActiveSwitch: () => null }))

const item: Stream = {
  id: "movie-1",
  tvgName: "Example Movie",
  name: null,
  active: true,
  playUrl: "http://line.iptvharmony.co:80/movie/example/secret/123.mkv",
}

function render(overrides: Partial<Stream> = {}, showDownload = true) {
  return renderToStaticMarkup(
    <ListStream
      item={{ ...item, ...overrides }}
      editHref="/edit-movie/movie-1"
      playHref="/play/media/movie-1"
      queryKey="media"
      showDownload={showDownload}
    />,
  )
}

describe("ListStream download action", () => {
  it("links directly to the complete stream URL while retaining Edit and Play", () => {
    const html = render()
    expect(html).toContain(`href="${item.playUrl}"`)
    expect(html).toContain("Download</a>")
    expect(html).toContain('href="/edit-movie/movie-1"')
    expect(html).toContain('href="/play/media/movie-1"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it("keeps an already absolute stream URL unchanged", () => {
    const url = "https://cdn.example.com/movie.mp4?token=example"
    expect(render({ playUrl: url })).toContain(`href="${url}"`)
  })

  it("does not render Download when the stream URL is missing", () => {
    expect(render({ playUrl: null })).not.toContain("Download</a>")
  })

  it("does not add Download to other stream lists", () => {
    expect(render({}, false)).not.toContain("Download</a>")
  })
})
