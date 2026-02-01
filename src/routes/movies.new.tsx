import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { MovieForm } from "~/components/MovieForm"

export const Route = createFileRoute("/movies/new")({
  component: PageAddMovie,
})

function PageAddMovie() {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <MovieForm
      mode="create"
      onMediaSave={async (created) => {
        await queryClient.invalidateQueries({ queryKey: ["media"] })
        await router.invalidate()
        navigate({ to: "/movies/$id", params: { id: created.id } })
      }}
    />
  )
}
