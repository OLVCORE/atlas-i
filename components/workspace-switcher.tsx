import { getActiveWorkspaceId, getOrSetActiveWorkspace } from "@/lib/workspace-active"
import { listWorkspaces } from "@/lib/workspace"
import { WorkspaceSwitcherClient } from "@/components/workspace-switcher-client"

export async function WorkspaceSwitcher() {
  const workspaces = await listWorkspaces()
  
  // Tentar ler do cookie primeiro, senão buscar do banco
  let activeWorkspaceId = await getActiveWorkspaceId()
  if (!activeWorkspaceId) {
    activeWorkspaceId = await getOrSetActiveWorkspace()
  }
  
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  if (workspaces.length <= 1) {
    return (
      <div className="text-sm font-medium">
        {activeWorkspace?.name || "Workspace"}
      </div>
    )
  }

  return (
    <WorkspaceSwitcherClient
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId || ""}
    />
  )
}

