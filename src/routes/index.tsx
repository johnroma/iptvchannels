import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div>
      <h2>Hello World!</h2>
      <p>Welcome to IPTV Channels management system.</p>
    </div>
  )
}
