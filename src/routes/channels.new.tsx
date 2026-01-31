import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { ChannelForm } from "~/components/ChannelForm"

export const Route = createFileRoute("/channels/new")({
  component: PageAddChannel,
})

function PageAddChannel() {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <ChannelForm
      mode="create"
      onChannelSave={async (created) => {
        await queryClient.invalidateQueries({ queryKey: ["channels"] })
        await router.invalidate()
        navigate({ to: "/channels/$id", params: { id: created.id } })
      }}
    />
  )
}
