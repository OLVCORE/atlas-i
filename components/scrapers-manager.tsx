/**
 * MC13: Componente para gerenciar scrapers bancários
 */

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { listAvailableBanks } from "@/lib/scrapers/registry"
import type { BankCode } from "@/lib/scrapers/types"

// Importar dinamicamente para evitar erro de SSR
const availableBanks = typeof window !== 'undefined' ? listAvailableBanks() : []

type Connection = {
  id: string
  bank_code: BankCode
  entity_id: string
  account_id?: string
  is_active: boolean
  last_sync_at?: string
  last_sync_status?: 'success' | 'error' | 'pending'
  last_sync_error?: string
  schedule_frequency?: 'daily' | 'weekly' | 'monthly'
  schedule_time?: string
}

export function ScrapersManager({
  entities,
  accounts,
}: {
  entities: Array<{ id: string; legal_name: string; type: string }>
  accounts: Array<{ id: string; name: string; entity_id: string }>
}) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    bankCode: '' as BankCode | '',
    entityId: '',
    username: '',
    password: '',
    twoFactorSecret: '',
    accountId: '',
    scheduleFrequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    scheduleTime: '06:00',
  })

  const [banks] = useState(() => listAvailableBanks())

  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      const response = await fetch('/api/scrapers/list')
      const data = await response.json()
      if (data.ok) {
        setConnections(data.connections)
      }
    } catch (error) {
      console.error('Erro ao carregar conexões:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!formData.bankCode || !formData.entityId || !formData.username || !formData.password) {
      alert('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const response = await fetch('/api/scrapers/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (data.ok) {
        alert('Conexão criada com sucesso!')
        setShowAddForm(false)
        setFormData({
          bankCode: '' as BankCode | '',
          entityId: '',
          username: '',
          password: '',
          twoFactorSecret: '',
          accountId: '',
          scheduleFrequency: 'daily',
          scheduleTime: '06:00',
        })
        loadConnections()
      } else {
        alert(`Erro: ${data.message || data.error}`)
      }
    } catch (error) {
      alert(`Erro ao conectar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId)
    try {
      const response = await fetch('/api/scrapers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })

      const data = await response.json()
      if (data.ok) {
        alert(`Sincronização concluída! ${data.result.importResult?.transactionsImported || 0} transações importadas.`)
        loadConnections()
      } else {
        alert(`Erro na sincronização: ${data.message || data.error}`)
      }
    } catch (error) {
      alert(`Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setSyncing(null)
    }
  }

  const getBankName = (code: BankCode) => {
    return banks.find(b => b.code === code)?.name || code
  }

  const getEntityName = (entityId: string) => {
    return entities.find(e => e.id === entityId)?.legal_name || entityId
  }

  if (loading) {
    return <div>Carregando...</div>
  }

  return (
    <div className="space-y-6">
      {/* Lista de conexões */}
      <div className="space-y-4">
        {connections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma conexão configurada</p>
            </CardContent>
          </Card>
        ) : (
          connections.map((conn) => (
            <Card key={conn.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{getBankName(conn.bank_code)}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(conn.id)}
                      disabled={syncing === conn.id}
                    >
                      {syncing === conn.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sincronizar
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Entidade:</strong> {getEntityName(conn.entity_id)}
                  </div>
                  {conn.last_sync_at && (
                    <div>
                      <strong>Última sincronização:</strong>{' '}
                      {new Date(conn.last_sync_at).toLocaleString('pt-BR')}
                    </div>
                  )}
                  {conn.last_sync_status && (
                    <div className="flex items-center gap-2">
                      <strong>Status:</strong>
                      {conn.last_sync_status === 'success' ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Sucesso
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          Erro
                        </span>
                      )}
                    </div>
                  )}
                  {conn.last_sync_error && (
                    <div className="text-red-600 text-xs">
                      {conn.last_sync_error}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Formulário de adicionar */}
      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Nova Conexão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Banco *</Label>
              <Select
                value={formData.bankCode}
                onValueChange={(v) => setFormData({ ...formData, bankCode: v as BankCode })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Entidade *</Label>
              <Select
                value={formData.entityId}
                onValueChange={(v) => setFormData({ ...formData, entityId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a entidade" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.legal_name} ({entity.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Usuário/CPF/CNPJ *</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="CPF, CNPJ ou usuário"
              />
            </div>

            <div>
              <Label>Senha *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Senha do banco"
              />
            </div>

            <div>
              <Label>Secret 2FA (opcional)</Label>
              <Input
                value={formData.twoFactorSecret}
                onChange={(e) => setFormData({ ...formData, twoFactorSecret: e.target.value })}
                placeholder="Secret para autenticação de dois fatores"
              />
            </div>

            <div>
              <Label>Conta (opcional)</Label>
              <Select
                value={formData.accountId}
                onValueChange={(v) => setFormData({ ...formData, accountId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {accounts
                    .filter((acc) => acc.entity_id === formData.entityId)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequência de sincronização</Label>
                <Select
                  value={formData.scheduleFrequency}
                  onValueChange={(v) =>
                    setFormData({ ...formData, scheduleFrequency: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={formData.scheduleTime}
                  onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleConnect} className="flex-1">
                Conectar
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Conexão
        </Button>
      )}
    </div>
  )
}

