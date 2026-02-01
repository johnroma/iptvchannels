import { createFileRoute, notFound } from "@tanstack/react-router"
import { getSeriesWithEpisodes } from "~/server/series"

export const Route = createFileRoute("/series/$id")({
  component: PageSeries,
  loader: async ({ params }) => {
    const seriesData = await getSeriesWithEpisodes({ data: params.id })
    if (!seriesData) {
      throw notFound()
    }
    return seriesData
  },
})

function PageSeries() {
  const data = Route.useLoaderData()
  return (
    <div>
      <h2>{data.name || data.tvgName}</h2>
      <p className="text-muted-foreground">
        {data.episodes.length} episodes
      </p>
    </div>
  )
}
