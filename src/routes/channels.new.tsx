import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChannelForm } from "~/components/ChannelForm"

export const Route = createFileRoute("/channels/new")({
  component: PageAddChannel,
})

function PageAddChannel() {
  const navigate = useNavigate()

  return (
    <ChannelForm
      mode="create"
      onChannelSave={(created) => {
        navigate({ to: "/channels/$id", params: { id: created.id } })
      }}
    />
  )
}
