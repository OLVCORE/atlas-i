"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle, RefreshCw, Search } from "lucide-react"
import { HelpTooltip } from "@/components/help/HelpTooltip"
import { EnvStatus } from "@/lib/connectors/env"

type Entity = {
  id: string
  legal_name: string
}

type ProviderCatalog = {
  id: string
  code: string
  name: string
  kind: 'aggregator' | 'open_finance_direct'
  homepage: string | null
  docs_url: string | null
}

type Provider = {
  id: string
  name: string
  kind: string
  status: string
  catalog_code?: string
  catalog_name?: string
}

type Connection = {
  id: string
  entity_id: string
  provider_id: string
  status: string
  last_sync_at: string | null
  last_error: string | null
  created_at: string
}

type AuditLog = {
  id: string
  action: string
  resource_type: string
  resource_id: string
  metadata: Record<string, any> | null
  created_at: string
}

export function ConnectionsWizardClient({
  entities,
  catalog,
  providers,
  connections,
  auditLogs,
  envStatus,
  activeConnections,
  lastSync,
  validateEnvAction,
  createProviderConfigAction,
  createConnectionAction,
  updateProviderStatusAction,
  syncConnectionAction,
}: {
  entities: Entity[]
  catalog: ProviderCatalog[]
  providers: Provider[]
  connections: Connection[]
  auditLogs: AuditLog[]
  envStatus: EnvStatus
  activeConnections: number
  lastSync: string | null
  validateEnvAction: () => Promise<EnvStatus>
  createProviderConfigAction: (catalogId: string, config?: Record<string, any>) => Promise<void>
  createConnectionAction: (entityId: string, providerConfigId: string) => Promise<void>
  updateProviderStatusAction: (providerId: string, status: 'active' | 'inactive') => Promise<void>
  syncConnectionAction: (connectionId: string) => Promise<void>
}) {
  const router = useRouter()
  
  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedCatalogId, setSelectedCatalogId] = useState("")
  const [providerConfig, setProviderConfig] = useState<Record<string, any>>({})
  const [connectionEntityId, setConnectionEntityId] = useState("")
  const [connectionProviderId, setConnectionProviderId] = useState("")
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [envCheck, setEnvCheck] = useState<EnvStatus | null>(envStatus)
  const [validatingEnv, setValidatingEnv] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState("")
  const [openingPluggyWidget, setOpeningPluggyWidget] = useState(false)

  // Filtro de auditoria
  const [auditFilter, setAuditFilter] = useState<string>("")

  const handleValidateEnv = async () => {
    setValidatingEnv(true)
    try {
      const status = await validateEnvAction()
      setEnvCheck(status)
    } catch (error) {
      console.error("Erro ao validar variáveis:", error)
    } finally {
      setValidatingEnv(false)
    }
  }

  const handleCreateProviderConfig = async () => {
    if (!selectedCatalogId) return
    setLoading(true)
    try {
      await createProviderConfigAction(selectedCatalogId, providerConfig)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao criar provider")
      setLoading(false)
    }
  }

  const handleCreateConnection = async () => {
    if (!connectionEntityId || !connectionProviderId) return
    setLoading(true)
    try {
      await createConnectionAction(connectionEntityId, connectionProviderId)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao criar conexão")
      setLoading(false)
    }
  }

  const handleSync = async (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId)
    if (connection?.status !== 'active') {
      alert("Ative a conexão para sincronizar.")
      return
    }
    
    setSyncingId(connectionId)
    try {
      await syncConnectionAction(connectionId)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao sincronizar")
    } finally {
      setSyncingId(null)
    }
  }

  const handleOpenPluggyWidget = async () => {
    // Verificar se há provider Pluggy ativo
    const pluggyProvider = providers.find((p) => p.catalog_code === 'pluggy' && p.status === 'active')
    if (!pluggyProvider) {
      alert("Configure e ative o provider Pluggy primeiro.")
      return
    }

    setOpeningPluggyWidget(true)
    try {
      // Obter connect token
      const tokenResponse = await fetch('/api/pluggy/connect-token')
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao obter connect token')
      }

      const { connectToken } = await tokenResponse.json()
      if (!connectToken) {
        throw new Error('Connect token não retornado')
      }

      // Verificar se PluggyConnect está disponível
      if (typeof window === 'undefined' || !(window as any).PluggyConnect) {
        throw new Error('Pluggy Connect widget não carregado. Recarregue a página.')
      }

      // Abrir widget
      ;(window as any).PluggyConnect({
        connectToken,
        onSuccess: async (payload: any) => {
          const itemId = payload?.itemId || payload?.item?.id

          if (!itemId) {
            alert('Erro: itemId não retornado pelo widget')
            return
          }

          try {
            // Persistir conexão
            const response = await fetch('/api/connections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                providerKey: 'pluggy',
                externalConnectionId: itemId,
                entityId: entities.length > 0 ? entities[0].id : undefined,
              }),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || 'Erro ao salvar conexão')
            }

            // Recarregar página para mostrar nova conexão
            router.refresh()
          } catch (error) {
            console.error('Erro ao salvar conexão:', error)
            alert(error instanceof Error ? error.message : 'Erro ao salvar conexão')
          }
        },
        onError: (error: any) => {
          console.error('Erro no widget Pluggy:', error)
          alert(error?.message || 'Erro ao conectar via Pluggy')
        },
      }).init()
    } catch (error) {
      console.error('Erro ao abrir widget Pluggy:', error)
      alert(error instanceof Error ? error.message : 'Erro ao abrir widget Pluggy')
    } finally {
      setOpeningPluggyWidget(false)
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'needs_setup':
        return 'Configuração necessária'
      case 'connecting':
        return 'Conectando'
      case 'active':
        return 'Ativo'
      case 'inactive':
        return 'Inativo'
      case 'error':
        return 'Erro'
      case 'revoked':
        return 'Revogado'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600'
      case 'connecting':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      case 'revoked':
      case 'inactive':
        return 'text-gray-400'
      default:
        return 'text-gray-600'
    }
  }

  const filteredCatalog = catalog.filter((p) =>
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(catalogSearch.toLowerCase())
  )

  const filteredAuditLogs = auditFilter
    ? auditLogs.filter((log) => log.resource_id === auditFilter || log.resource_type.includes(auditFilter))
    : auditLogs

  return (
    <div className="space-y-6">
      {/* Status do Ambiente */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Credenciais Detectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className={envCheck?.hasPluggyCredentials ? "text-green-600" : "text-red-600"}>
                {envCheck?.hasPluggyCredentials ? "Sim" : "Não"}
              </span>
              <Button size="sm" variant="outline" onClick={handleValidateEnv} disabled={validatingEnv}>
                {validatingEnv ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Provider Selecionado</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm text-muted-foreground">
              {providers.length > 0 ? providers[0].catalog_name || providers[0].name : "Nenhum"}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Conexões Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{activeConnections}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Último Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm text-muted-foreground">
              {lastSync ? new Date(lastSync).toLocaleString("pt-BR") : "Nunca"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Wizard */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Conexões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Passo 1: Escolher Provider do Catálogo */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Passo 1: Escolher Provider</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Selecione um provider do catálogo para configurar neste workspace.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="catalogSearch">Buscar Provider</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="catalogSearch"
                    placeholder="Digite para buscar..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="catalogSelect">Provider</Label>
                  <HelpTooltip contentKey="connections.catalog" />
                </div>
                <select
                  id="catalogSelect"
                  value={selectedCatalogId}
                  onChange={(e) => setSelectedCatalogId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione um provider</option>
                  {filteredCatalog.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.kind === 'aggregator' ? 'Agregador' : 'Open Finance'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep(2)} disabled={!selectedCatalogId}>
                  Próximo
                </Button>
              </div>
            </div>
          )}

          {/* Passo 2: Criar Config do Workspace */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Passo 2: Configuração do Provider</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure o provider para este workspace. Status inicial: inativo.
                </p>
              </div>

              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm">
                  <strong>Provider selecionado:</strong>{" "}
                  {catalog.find((p) => p.id === selectedCatalogId)?.name}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="configEnv">Ambiente (opcional)</Label>
                  <HelpTooltip contentKey="connections.config" />
                </div>
                <Input
                  id="configEnv"
                  placeholder="sandbox, production"
                  value={providerConfig.env || ""}
                  onChange={(e) => setProviderConfig({ ...providerConfig, env: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateProviderConfig} disabled={loading || !selectedCatalogId}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Configuração"}
                </Button>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Voltar
                </Button>
              </div>
            </div>
          )}

          {/* Passo 3: Criar Connection */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Passo 3: Criar Conexão</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Vincule uma entidade a um provider configurado.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="connectionEntity">Entidade</Label>
                <select
                  id="connectionEntity"
                  value={connectionEntityId}
                  onChange={(e) => setConnectionEntityId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione a entidade</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="connectionProvider">Provider Config</Label>
                  <HelpTooltip contentKey="connections.connection" />
                </div>
                <select
                  id="connectionProvider"
                  value={connectionProviderId}
                  onChange={(e) => setConnectionProviderId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione o provider</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.catalog_name || p.name} ({p.status === 'active' ? 'Ativo' : 'Inativo'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateConnection} disabled={loading || !connectionEntityId || !connectionProviderId}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar Conexão
                </Button>
                <Button variant="outline" onClick={() => {
                  setStep(1)
                  setConnectionEntityId("")
                  setConnectionProviderId("")
                }}>
                  Voltar
                </Button>
              </div>
            </div>
          )}

          {/* Lista de Providers e Conexões */}
          {providers.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Providers Configurados</h3>
                <Button onClick={() => {
                  setStep(1)
                  setSelectedCatalogId("")
                }} variant="outline">
                  Adicionar Provider
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.catalog_name || p.name}</TableCell>
                      <TableCell>
                        <span className={getStatusColor(p.status)}>
                          {getStatusLabel(p.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateProviderStatusAction(p.id, p.status === 'active' ? 'inactive' : 'active')}
                        >
                          {p.status === 'active' ? 'Desativar' : 'Ativar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Conexões</h3>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleOpenPluggyWidget}
                    variant="default"
                    disabled={openingPluggyWidget}
                  >
                    {openingPluggyWidget ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Abrindo...
                      </>
                    ) : (
                      'Conectar via Pluggy'
                    )}
                  </Button>
                  <Button onClick={() => {
                    setStep(3)
                    setConnectionEntityId("")
                    setConnectionProviderId("")
                  }} variant="outline">
                    Nova Conexão Manual
                  </Button>
                </div>
              </div>

              {connections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conexão registrada até o momento.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Última Sincronização</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections.map((conn) => {
                      const entity = entities.find((e) => e.id === conn.entity_id)
                      const provider = providers.find((p) => p.id === conn.provider_id)
                      return (
                        <TableRow key={conn.id}>
                          <TableCell>{entity?.legal_name || "N/A"}</TableCell>
                          <TableCell>{provider?.catalog_name || provider?.name || "N/A"}</TableCell>
                          <TableCell>
                            <span className={getStatusColor(conn.status)}>
                              {getStatusLabel(conn.status)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {conn.last_sync_at
                              ? new Date(conn.last_sync_at).toLocaleString("pt-BR")
                              : "Nunca"}
                          </TableCell>
                          <TableCell>
                            {conn.status === 'active' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSync(conn.id)}
                                disabled={syncingId === conn.id}
                              >
                                {syncingId === conn.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Sincronizar agora"
                                )}
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">Ative para sincronizar</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {/* Inicial: mostrar botão para começar */}
          {providers.length === 0 && step === 1 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Configure um provider para começar a usar conexões.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auditoria */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Auditoria (Últimos 20 eventos)</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Filtrar por connection/resource..."
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAuditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento de auditoria registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Tipo de Recurso</TableHead>
                  <TableHead>ID do Recurso</TableHead>
                  <TableHead>Metadados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{log.action}</code>
                    </TableCell>
                    <TableCell>{log.resource_type}</TableCell>
                    <TableCell>
                      <code className="text-xs">{log.resource_id.substring(0, 8)}...</code>
                    </TableCell>
                    <TableCell>
                      {log.metadata ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">Ver</summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-w-md">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

