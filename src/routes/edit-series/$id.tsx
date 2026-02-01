import { useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { SeriesForm } from "~/components/SeriesForm"
import { getSeriesWithEpisodes } from "~/server/series"

export const Route = createFileRoute("/edit-series/$id")({
  component: PageEditSeries,
  loader: async ({ params }) => {
    const seriesData = await getSeriesWithEpisodes({ data: params.id })
    if (!seriesData) {
      throw notFound()
    }
    return seriesData
  },
})

function PageEditSeries() {
  const seriesData = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <SeriesForm
      mode="edit"
      series={seriesData}
      onSeriesSave={async (updated) => {
        await queryClient.invalidateQueries({ queryKey: ["series"] })
        await router.invalidate()

        if (
          document.referrer &&
          document.referrer.startsWith(globalThis.location.origin)
        ) {
          router.history.back()
        } else {
          navigate({ to: "/series/$id", params: { id: updated.id } })
        }
      }}
    />
  )
}
