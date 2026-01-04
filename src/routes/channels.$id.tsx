import { createFileRoute, notFound } from "@tanstack/react-router"
import { getChannelById } from "~/server/channels"

export const Route = createFileRoute("/channels/$id")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const id = Number(params.id)
    const channelData = await getChannelById({ data: { id } })
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
      Hello "/channels/{tvgName} - {tvgId}!"
    </div>
  )
}
