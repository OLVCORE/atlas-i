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
    // Identificação
    cpf: '',
    cnpj: '',
    // Dados bancários (OBRIGATÓRIO para Itaú PF)
    agency: '',
    accountNumber: '',
    accountDigit: '',
    // Autenticação
    password: '', // NUNCA será renderizado diretamente no DOM
    twoFactorSecret: '',
    // Vinculação
    accountId: '',
    scheduleFrequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    scheduleTime: '06:00',
  })
  
  // Estado separado para input de senha (nunca expor value no DOM)
  const [passwordInput, setPasswordInput] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionTested, setConnectionTested] = useState(false)
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null)

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

  const handleTestConnection = async () => {
    // Validar campos obrigatórios baseado no banco e tipo de entidade
    const selectedEntity = entities.find(e => e.id === formData.entityId)
    const isPF = selectedEntity?.type === 'PF'
    const isItau = formData.bankCode === 'itau'
    
    let isValid = true
    let errorMessage = ''
    
    if (!formData.bankCode || !formData.entityId || !passwordInput) {
      isValid = false
      errorMessage = 'Preencha todos os campos obrigatórios'
    } else if (isItau && isPF) {
      // Itaú PF: precisa CPF + Agência + Conta + Dígito
      if (!formData.cpf || formData.cpf.length !== 11) {
        isValid = false
        errorMessage = 'CPF deve ter 11 dígitos'
      } else if (!formData.agency || formData.agency.length !== 4) {
        isValid = false
        errorMessage = 'Agência deve ter 4 dígitos'
      } else if (!formData.accountNumber || formData.accountNumber.length === 0) {
        isValid = false
        errorMessage = 'Número da conta é obrigatório'
      } else if (!formData.accountDigit || formData.accountDigit.length === 0) {
        isValid = false
        errorMessage = 'Dígito da conta é obrigatório'
      }
    } else if (isItau && !isPF) {
      // Itaú PJ: precisa CNPJ
      if (!formData.cnpj || formData.cnpj.length !== 14) {
        isValid = false
        errorMessage = 'CNPJ deve ter 14 dígitos'
      }
    } else {
      // Outros bancos: CPF ou CNPJ
      if (isPF && (!formData.cpf || formData.cpf.length !== 11)) {
        isValid = false
        errorMessage = 'CPF deve ter 11 dígitos'
      } else if (!isPF && (!formData.cnpj || formData.cnpj.length !== 14)) {
        isValid = false
        errorMessage = 'CNPJ deve ter 14 dígitos'
      }
    }
    
    if (!isValid) {
      alert(errorMessage)
      return
    }

    setTestingConnection(true)
    setConnectionTestResult(null)
    
    try {
      // Preparar credenciais baseado no banco
      const credentials: any = {
        bankCode: formData.bankCode,
        password: passwordInput,
        twoFactorSecret: formData.twoFactorSecret || undefined,
      }
      
      if (isItau && isPF) {
        credentials.cpf = formData.cpf
        credentials.agency = formData.agency
        credentials.accountNumber = formData.accountNumber
        credentials.accountDigit = formData.accountDigit
      } else if (isItau && !isPF) {
        credentials.cnpj = formData.cnpj
      } else {
        // Outros bancos
        if (isPF) {
          credentials.cpf = formData.cpf
        } else {
          credentials.cnpj = formData.cnpj
        }
      }
      
      // Testar conexão sem salvar
      const response = await fetch('/api/scrapers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()
      if (data.ok && data.connectionTest?.success) {
        setConnectionTested(true)
        setConnectionTestResult({ success: true, message: 'Conexão testada com sucesso! Você pode salvar agora.' })
        // Só agora copiar para formData.password (mas nunca renderizar)
        setFormData({ ...formData, password: passwordInput })
      } else {
        setConnectionTested(false)
        setConnectionTestResult({ 
          success: false, 
          message: data.message || 'Falha ao conectar. Verifique as credenciais.' 
        })
      }
    } catch (error) {
      setConnectionTested(false)
      setConnectionTestResult({ 
        success: false, 
        message: `Erro ao testar conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleConnect = async () => {
    // Validar campos obrigatórios (mesma lógica do teste)
    const selectedEntity = entities.find(e => e.id === formData.entityId)
    const isPF = selectedEntity?.type === 'PF'
    const isItau = formData.bankCode === 'itau'
    
    let isValid = true
    let errorMessage = ''
    
    if (!formData.bankCode || !formData.entityId || !passwordInput) {
      isValid = false
      errorMessage = 'Preencha todos os campos obrigatórios'
    } else if (isItau && isPF) {
      if (!formData.cpf || formData.cpf.length !== 11) {
        isValid = false
        errorMessage = 'CPF deve ter 11 dígitos'
      } else if (!formData.agency || formData.agency.length !== 4) {
        isValid = false
        errorMessage = 'Agência deve ter 4 dígitos'
      } else if (!formData.accountNumber || formData.accountNumber.length === 0) {
        isValid = false
        errorMessage = 'Número da conta é obrigatório'
      } else if (!formData.accountDigit || formData.accountDigit.length === 0) {
        isValid = false
        errorMessage = 'Dígito da conta é obrigatório'
      }
    } else if (isItau && !isPF) {
      if (!formData.cnpj || formData.cnpj.length !== 14) {
        isValid = false
        errorMessage = 'CNPJ deve ter 14 dígitos'
      }
    } else {
      if (isPF && (!formData.cpf || formData.cpf.length !== 11)) {
        isValid = false
        errorMessage = 'CPF deve ter 11 dígitos'
      } else if (!isPF && (!formData.cnpj || formData.cnpj.length !== 14)) {
        isValid = false
        errorMessage = 'CNPJ deve ter 14 dígitos'
      }
    }
    
    if (!isValid) {
      alert(errorMessage)
      return
    }

    // REQUERER teste de conexão antes de salvar
    if (!connectionTested || !connectionTestResult?.success) {
      if (!confirm('⚠️ ATENÇÃO: Você não testou a conexão ainda. É recomendado testar antes de salvar. Deseja continuar mesmo assim?')) {
        return
      }
    }

    try {
      // Preparar credenciais para salvar
      const credentials: any = {
        bankCode: formData.bankCode,
        entityId: formData.entityId,
        password: passwordInput,
        twoFactorSecret: formData.twoFactorSecret || undefined,
        accountId: formData.accountId || undefined,
        scheduleFrequency: formData.scheduleFrequency,
        scheduleTime: formData.scheduleTime,
      }
      
      if (isItau && isPF) {
        credentials.cpf = formData.cpf
        credentials.agency = formData.agency
        credentials.accountNumber = formData.accountNumber
        credentials.accountDigit = formData.accountDigit
      } else if (isItau && !isPF) {
        credentials.cnpj = formData.cnpj
      } else {
        if (isPF) {
          credentials.cpf = formData.cpf
        } else {
          credentials.cnpj = formData.cnpj
        }
      }
      
      const response = await fetch('/api/scrapers/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()
      if (data.ok) {
        alert('✅ Conexão salva com sucesso! As credenciais foram criptografadas e armazenadas com segurança.')
        setShowAddForm(false)
        setFormData({
          bankCode: '' as BankCode | '',
          entityId: '',
          cpf: '',
          cnpj: '',
          agency: '',
          accountNumber: '',
          accountDigit: '',
          password: '', // Limpar
          twoFactorSecret: '',
          accountId: '',
          scheduleFrequency: 'daily',
          scheduleTime: '06:00',
        })
        setPasswordInput('') // Limpar input de senha
        setConnectionTested(false)
        setConnectionTestResult(null)
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
            <CardTitle>Nova Conexão Bancária</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Configure uma conexão automática para importar extratos e transações do banco
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {entities.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  ⚠️ Nenhuma entidade cadastrada
                </p>
                <p className="text-sm text-yellow-700 mb-3">
                  Você precisa criar uma entidade (Pessoa Física ou Pessoa Jurídica) antes de configurar scrapers.
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/app/entities'}
                >
                  Criar Entidade
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <Label>Entidade *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Selecione a entidade (PF ou PJ) que possui esta conta bancária
                  </p>
                  <Select
                    value={formData.entityId}
                    onValueChange={(v) => {
                      setFormData({ 
                        ...formData, 
                        entityId: v,
                        accountId: '' // Limpar conta ao trocar entidade
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a entidade (PF ou PJ)" />
                    </SelectTrigger>
                    <SelectContent>
                      {entities.map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.legal_name} ({entity.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Banco *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Selecione o banco que você deseja conectar
                  </p>
                  <Select
                    value={formData.bankCode}
                    onValueChange={(v) => setFormData({ ...formData, bankCode: v as BankCode })}
                    disabled={!formData.entityId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.entityId ? "Selecione o banco" : "Selecione primeiro a entidade"} />
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
                  <Label>Usuário/CPF/CNPJ *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    CPF (se PF) ou CNPJ (se PJ), ou nome de usuário do banco
                  </p>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="CPF, CNPJ ou usuário"
                    disabled={!formData.bankCode}
                  />
                </div>

                <div>
                  <Label>Senha *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Senha de acesso ao internet banking. <strong className="text-red-600">Nunca compartilhe sua senha.</strong>
                  </p>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value)
                        setConnectionTested(false) // Resetar teste quando senha mudar
                        setConnectionTestResult(null)
                      }}
                      placeholder="Digite sua senha"
                      disabled={!formData.bankCode}
                      autoComplete="new-password"
                      className="font-mono"
                    />
                    {passwordInput && !connectionTested && (
                      <p className="text-xs text-yellow-600">
                        ⚠️ Recomendado: Teste a conexão antes de salvar para garantir que as credenciais estão corretas.
                      </p>
                    )}
                    {connectionTestResult && (
                      <div className={`p-2 rounded text-xs ${connectionTestResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        {connectionTestResult.success ? '✅' : '❌'} {connectionTestResult.message}
                      </div>
                    )}
                    {passwordInput && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={testingConnection || !formData.bankCode || !formData.entityId || !passwordInput}
                      >
                        {testingConnection ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Testando...
                          </>
                        ) : (
                          '🔒 Testar Conexão'
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Secret 2FA (opcional)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Se o banco usar autenticação de dois fatores (2FA), informe o secret aqui
                  </p>
                  <Input
                    value={formData.twoFactorSecret}
                    onChange={(e) => setFormData({ ...formData, twoFactorSecret: e.target.value })}
                    placeholder="Secret para autenticação de dois fatores (opcional)"
                    disabled={!formData.bankCode}
                  />
                </div>

                <div>
                  <Label>Conta (opcional)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Selecione uma conta existente ou deixe vazio para criar automaticamente
                  </p>
                  <Select
                    value={formData.accountId || undefined}
                    onValueChange={(v) => setFormData({ ...formData, accountId: v === "__none__" ? "" : v })}
                    disabled={!formData.entityId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.entityId ? "Selecione a conta (opcional)" : "Selecione primeiro a entidade"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma (criar automaticamente)</SelectItem>
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

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    🔒 Segurança
                  </p>
                  <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                    <li>Suas credenciais são <strong>criptografadas</strong> antes de serem salvas no banco de dados</li>
                    <li>A senha <strong>nunca</strong> é exposta no código HTML</li>
                    <li>Apenas você pode descriptografar suas credenciais (baseado no seu workspace)</li>
                    <li>Recomendamos testar a conexão antes de salvar para garantir que está funcionando</li>
                  </ul>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleConnect} 
                    className="flex-1"
                    disabled={!formData.entityId || !formData.bankCode || !passwordInput}
                    variant={connectionTested && connectionTestResult?.success ? "default" : "secondary"}
                  >
                    {connectionTested && connectionTestResult?.success ? '✅ Salvar Conexão' : '💾 Salvar Conexão'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false)
                      setFormData({
                        bankCode: '' as BankCode | '',
                        entityId: '',
                        username: '',
                        password: '', // Limpar
                        twoFactorSecret: '',
                        accountId: '',
                        scheduleFrequency: 'daily',
                        scheduleTime: '06:00',
                      })
                      setPasswordInput('') // Limpar input de senha
                      setConnectionTested(false)
                      setConnectionTestResult(null)
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            )}
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

