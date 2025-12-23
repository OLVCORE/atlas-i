import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listEntities } from "@/lib/entities"
import { listProviderCatalog } from "@/lib/connectors/catalog"
import { listProviders, createProviderConfig, updateProviderStatus } from "@/lib/connectors/providers"
import { listConnections, createConnection, updateConnectionStatus } from "@/lib/connectors/connections"
import { listAuditLogs } from "@/lib/connectors/sync"
import { getEnvStatus } from "@/lib/connectors/env"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConnectionsWizardClient } from "@/components/connections-wizard-client"

async function validateEnvAction() {
  "use server"
  return getEnvStatus()
}

async function createProviderConfigAction(catalogId: string, config?: Record<string, any>) {
  "use server"
  await createProviderConfig(catalogId, config)
  redirect("/app/connections")
}

async function createConnectionAction(entityId: string, providerConfigId: string) {
  "use server"
  await createConnection(entityId, providerConfigId)
  redirect("/app/connections")
}

async function updateProviderStatusAction(providerId: string, status: 'active' | 'inactive') {
  "use server"
  await updateProviderStatus(providerId, status)
  redirect("/app/connections")
}

async function syncConnectionAction(connectionId: string) {
  "use server"
  const { syncPluggyConnection } = await import("@/lib/pluggy/sync")
  await syncPluggyConnection(connectionId)
  redirect("/app/connections")
}

export default async function ConnectionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let entities = []
  let catalog = []
  let providers = []
  let connections = []
  let auditLogs = []
  let envStatus = null

  try {
    entities = await listEntities()
    catalog = await listProviderCatalog()
    providers = await listProviders()
    connections = await listConnections()
    auditLogs = await listAuditLogs(20)
    envStatus = getEnvStatus()
  } catch (error) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar dados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calcular estatísticas
  const activeConnections = connections.filter((c) => c.status === 'active').length
  const lastSync = connections
    .filter((c) => c.last_sync_at)
    .sort((a, b) => new Date(b.last_sync_at!).getTime() - new Date(a.last_sync_at!).getTime())[0]
    ?.last_sync_at

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Conexões</h1>
          <p className="text-muted-foreground">
            ATLAS-i está pronto para conectar via agregador no MC8. Aqui você cadastra o provider e prepara as conexões.
          </p>
        </div>

        <ConnectionsWizardClient
          entities={entities}
          catalog={catalog}
          providers={providers}
          connections={connections}
          auditLogs={auditLogs}
          envStatus={envStatus}
          activeConnections={activeConnections}
          lastSync={lastSync}
          validateEnvAction={validateEnvAction}
          createProviderConfigAction={createProviderConfigAction}
          createConnectionAction={createConnectionAction}
          updateProviderStatusAction={updateProviderStatusAction}
          syncConnectionAction={syncConnectionAction}
        />
      </div>
    </div>
  )
}
