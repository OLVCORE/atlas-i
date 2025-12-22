import { createClient } from "@/lib/supabase/server"
import { getOrSetActiveWorkspace } from "./workspace-active"

export async function getActiveWorkspace() {
  const workspaceId = await getOrSetActiveWorkspace()
  const supabase = await createClient()

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single()

  if (error) {
    throw new Error(`Erro ao carregar workspace: ${error.message}`)
  }

  if (!workspace) {
    throw new Error("Workspace não encontrado")
  }

  return workspace
}

export async function getOrCreateWorkspace() {
  return await getActiveWorkspace()
}

export async function listWorkspaces() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)

  if (error) {
    throw new Error(`Erro ao buscar workspaces: ${error.message}`)
  }

  if (!memberships || memberships.length === 0) {
    // Garantir que existe um workspace (getOrSetActiveWorkspace cria se necessário)
    const { getOrSetActiveWorkspace } = await import("./workspace-active")
    const workspaceId = await getOrSetActiveWorkspace()
    
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single()

    return workspace ? [workspace] : []
  }

  const workspaceIds = memberships.map((m) => m.workspace_id)

  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", workspaceIds)
    .order("created_at", { ascending: false })

  if (workspacesError) {
    throw new Error(`Erro ao listar workspaces: ${workspacesError.message}`)
  }

  return workspaces || []
}

export async function createWorkspace(name: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const { data: newWorkspace, error: createError } = await supabase
    .from("workspaces")
    .insert({
      name,
      created_by: user.id,
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Erro ao criar workspace: ${createError.message}`)
  }

  // Adicionar usuário como owner
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: newWorkspace.id,
      user_id: user.id,
      role: "owner",
    })

  if (memberError) {
    throw new Error(`Erro ao adicionar membro ao workspace: ${memberError.message}`)
  }

  // Definir como workspace ativo
  const { setActiveWorkspaceId } = await import("./workspace-active")
  await setActiveWorkspaceId(newWorkspace.id)

  return newWorkspace
}

