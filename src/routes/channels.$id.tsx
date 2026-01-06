import { createFileRoute, notFound } from "@tanstack/react-router"
import { getChannelById } from "~/server/channels"

export const Route = createFileRoute("/channels/$id")({
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
  const { tvgName, tvgId } = Route.useLoaderData()
  return (
    <div>
      <h2>
        {tvgName} - {tvgId}
      </h2>
      $ Hello "/channels/{tvgName} - {tvgId}!"
    </div>
  )
}
