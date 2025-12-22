import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

const WORKSPACE_COOKIE_NAME = "atlas-workspace-id"

export async function getActiveWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies()
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value
  
  if (workspaceId) {
    // Validar que o usuário tem acesso a este workspace
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return null
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single()

    if (membership) {
      return workspaceId
    }
  }

  return null
}

export async function setActiveWorkspaceId(workspaceId: string) {
  const cookieStore = await cookies()
  
  // Validar que o usuário tem acesso a este workspace
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single()

  if (!membership) {
    throw new Error("Acesso negado a este workspace")
  }

  cookieStore.set(WORKSPACE_COOKIE_NAME, workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 ano
    path: "/",
  })
}

export async function getOrSetActiveWorkspace(): Promise<string> {
  const activeId = await getActiveWorkspaceId()
  if (activeId) {
    return activeId
  }

  // Se não tem workspace ativo, buscar o primeiro disponível
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  if (membership?.workspace_id) {
    // Não setar cookie aqui - apenas retornar o ID
    // O cookie será setado quando necessário via Server Action
    return membership.workspace_id
  }

  // Se não tem nenhum workspace, criar um padrão

  // Criar workspace padrão
  const { data: newWorkspace, error: createError } = await supabase
    .from("workspaces")
    .insert({
      name: "Meu Workspace",
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

  // Não setar cookie aqui - apenas retornar o ID
  // O cookie será setado quando necessário via Server Action
  return newWorkspace.id
}

