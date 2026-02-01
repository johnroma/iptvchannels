import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { SeriesForm } from "~/components/SeriesForm"

export const Route = createFileRoute("/series/new")({
  component: PageAddSeries,
})

function PageAddSeries() {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <SeriesForm
      mode="create"
      onSeriesSave={async (created) => {
        await queryClient.invalidateQueries({ queryKey: ["series"] })
        await router.invalidate()
        navigate({ to: "/series/$id", params: { id: created.id } })
      }}
    />
  )
}
