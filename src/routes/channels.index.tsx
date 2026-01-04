import { createFileRoute, Link } from "@tanstack/react-router"
import { listChannels } from "~/server/channels"

export const Route = createFileRoute("/channels/")({
  component: RouteComponent,
  loader: async () => {
    return listChannels()
  },
})

function RouteComponent() {
  const data = Route.useLoaderData()
  if (data.length === 0) {
    return <div>No channels found.</div>
  }

  return (
    <>
      <div>Hello "/channels"!</div>
      <ul>
        {data.map((channel) => (
          <li key={channel.id}>
            <span>{channel.tvgName}</span>
            {" - "}
            <Link
              to="/channels/$id"
              params={{ id: channel.id.toString() }}
            >
              View Channel {channel.id}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
