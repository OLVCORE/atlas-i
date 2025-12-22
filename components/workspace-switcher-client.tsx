"use client"

import { useRouter } from "next/navigation"
import { startTransition } from "react"

async function switchWorkspace(workspaceId: string) {
  const response = await fetch("/api/workspace/switch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspaceId }),
  })

  if (!response.ok) {
    throw new Error("Erro ao alterar workspace")
  }
}

export function WorkspaceSwitcherClient({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: Array<{ id: string; name: string }>
  activeWorkspaceId: string
}) {
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newWorkspaceId = e.target.value
    if (newWorkspaceId === activeWorkspaceId) return

    startTransition(async () => {
      try {
        await switchWorkspace(newWorkspaceId)
        router.refresh()
        router.push("/app")
      } catch (error) {
        console.error("Erro ao alterar workspace:", error)
      }
    })
  }

  return (
    <select
      value={activeWorkspaceId}
      onChange={handleChange}
      className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {workspaces.map((workspace) => (
        <option key={workspace.id} value={workspace.id}>
          {workspace.name}
        </option>
      ))}
    </select>
  )
}

