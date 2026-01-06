import { createFileRoute, notFound } from "@tanstack/react-router"
import { ChannelForm } from "~/components/ChannelForm"
import { getChannelById } from "~/server/channels"

export const Route = createFileRoute("/edit/$id")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const id = params.id
    const channelData = await getChannelById({ data: id })
    if (!channelData) {
      throw notFound()
    }
    return channelData
  },
})

function RouteComponent() {
  const channel = Route.useLoaderData()
  return (
    <div>
      <ChannelForm channel={channel} />
    </div>
  )
}
