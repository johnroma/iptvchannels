import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { MediaForm } from "~/components/MediaForm"

export const Route = createFileRoute("/media/new")({
  component: PageAddMedia,
})

function PageAddMedia() {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <MediaForm
      mode="create"
      onMediaSave={async (created) => {
        await queryClient.invalidateQueries({ queryKey: ["media"] })
        await router.invalidate()
        navigate({ to: "/media/$id", params: { id: created.id } })
      }}
    />
  )
}
