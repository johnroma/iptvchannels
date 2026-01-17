import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { ChannelForm } from "~/components/ChannelForm"
import { getChannelById } from "~/server/channels"

export const Route = createFileRoute("/edit/$id")({
  component: PageEditChannel,
  loader: async ({ params }) => {
    const id = params.id
    const channelData = await getChannelById({ data: id })
    if (!channelData) {
      throw notFound()
    }
    return channelData
  },
})

function PageEditChannel() {
  const channel = Route.useLoaderData()
  const navigate = useNavigate()

  return (
    <ChannelForm
      mode="edit"
      channel={channel}
      onChannelSave={(updated) => {
        // Go back in history if there's somewhere to go, otherwise navigate to channel
        if (window.history.length > 1) {
          window.history.back()
        } else {
          navigate({ to: "/channels/$id", params: { id: updated.id } })
        }
      }}
    />
  )
}
