import { createFileRoute, notFound } from "@tanstack/react-router"
import { getStreamById } from "~/server/shared"

export const Route = createFileRoute("/media/$id")({
  component: PageMedia,
  loader: async ({ params }) => {
    const id = params.id
    const mediaData = await getStreamById({ data: { id, table: "media" } })
    if (!mediaData) {
      throw notFound()
    }
    return mediaData
  },
})

function PageMedia() {
  const { tvgName, tvgId, name } = Route.useLoaderData()
  return (
    <div>
      <h2>
        {tvgName} - {tvgId}
      </h2>
      $ Hello "/media/{tvgName} - {tvgId} - {name}!"
    </div>
  )
}
