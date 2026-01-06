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
            {" - "} {channel.name} <span> - </span>
            <Link
              to="/edit/$id"
              params={{ id: channel.id.toString() }}
              className="text-blue-600"
            >
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
