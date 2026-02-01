import { useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { type Media } from "~/db/schema"
import { MediaForm } from "~/components/MediaForm"
import { getStreamById } from "~/server/shared"

export const Route = createFileRoute("/edit-media/$id")({
  component: PageEditMedia,
  loader: async ({ params }): Promise<Media> => {
    const id = params.id
    const mediaData = await getStreamById({ data: { id, table: "media" } })
    if (!mediaData) {
      throw notFound()
    }
    return mediaData as Media
  },
})

function PageEditMedia() {
  const media = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <MediaForm
      mode="edit"
      media={media}
      onMediaSave={async (updated) => {
        await queryClient.invalidateQueries({ queryKey: ["media"] })
        await router.invalidate()

        if (
          document.referrer &&
          document.referrer.startsWith(globalThis.location.origin)
        ) {
          router.history.back()
        } else {
          navigate({ to: "/media/$id", params: { id: updated.id } })
        }
      }}
    />
  )
}
