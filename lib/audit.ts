/**
 * MC4.3.3: Sistema de Auditoria
 * 
 * Helper para gravar logs de auditoria de forma consistente
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'cancel' 
  | 'activate' 
  | 'complete' 
  | 'realize' 
  | 'link' 
  | 'unlink'
  | 'restore'
  | 'reverse'

export type AuditEntityType = 
  | 'commitment' 
  | 'contract' 
  | 'financial_schedule' 
  | 'contract_schedule' 
  | 'transaction'
  | 'alert'

/**
 * Grava um log de auditoria
 * 
 * @param action Ação realizada
 * @param entityType Tipo da entidade
 * @param entityId ID da entidade
 * @param before Estado anterior (opcional)
 * @param after Estado posterior (opcional)
 */
export async function logAudit(
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  before?: any,
  after?: any
): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Se não houver usuário, não gravar (pode ser operação automática)
    return
  }

  try {
    // Usar service role ou policy que permita INSERT
    // Por enquanto, tentar inserir diretamente (se RLS permitir)
    const { error } = await supabase
      .from("audit_logs")
      .insert({
        workspace_id: workspace.id,
        actor_user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        before: before ? JSON.parse(JSON.stringify(before)) : null,
        after: after ? JSON.parse(JSON.stringify(after)) : null,
      })

    if (error) {
      // Log mas não falha a operação principal
      console.error("[audit] Erro ao gravar audit log:", error)
    }
  } catch (err) {
    // Log mas não falha
    console.error("[audit] Erro ao gravar audit log:", err)
  }
}

