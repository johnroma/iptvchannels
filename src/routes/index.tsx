import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  return (
    <div className="m-10">
      <h2 className="text-2xl font-bold">Hello World!</h2>
      <p>Welcome to IPTV Channels management system.</p>
    </div>
  )
}
