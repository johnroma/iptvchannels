import { createFileRoute, notFound } from "@tanstack/react-router"
import { getStreamById } from "~/server/shared"

export const Route = createFileRoute("/movies/$id")({
  component: PageMovie,
  loader: async ({ params }) => {
    const id = params.id
    const movieData = await getStreamById({ data: { id, table: "media" } })
    if (!movieData) {
      throw notFound()
    }
    return movieData
  },
})

function PageMovie() {
  const { tvgName, tvgId, name } = Route.useLoaderData()
  return (
    <div>
      <h2>
        {tvgName} - {tvgId}
      </h2>
      <p>
        {name || tvgName}
      </p>
    </div>
  )
}
