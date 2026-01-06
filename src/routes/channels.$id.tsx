import { createFileRoute, notFound } from "@tanstack/react-router"
import { getChannelById } from "~/server/channels"

export const Route = createFileRoute("/channels/$id")({
  component: PageChannels,
  loader: async ({ params }) => {
    const id = params.id
    const channelData = await getChannelById({ data: id })
    if (!channelData) {
      throw notFound()
    }
    return channelData
  },
})

function PageChannels() {
  const { tvgName, tvgId, name } = Route.useLoaderData()
  return (
    <div>
      <h2>
        {tvgName} - {tvgId}
      </h2>
      $ Hello "/channels/{tvgName} - {tvgId} - {name}!"
    </div>
  )
}
