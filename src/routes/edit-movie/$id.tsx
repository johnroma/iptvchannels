import { useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { type Media } from "~/db/schema"
import { MovieForm } from "~/components/MovieForm"
import { getStreamById } from "~/server/shared"

export const Route = createFileRoute("/edit-movie/$id")({
  component: PageEditMovie,
  loader: async ({ params }): Promise<Media> => {
    const id = params.id
    const movieData = await getStreamById({ data: { id, table: "media" } })
    if (!movieData) {
      throw notFound()
    }
    return movieData as Media
  },
})

function PageEditMovie() {
  const movie = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <MovieForm
      mode="edit"
      media={movie}
      onMediaSave={async (updated) => {
        await queryClient.invalidateQueries({ queryKey: ["media"] })
        await router.invalidate()

        if (
          document.referrer &&
          document.referrer.startsWith(globalThis.location.origin)
        ) {
          router.history.back()
        } else {
          navigate({ to: "/movies/$id", params: { id: updated.id } })
        }
      }}
    />
  )
}
