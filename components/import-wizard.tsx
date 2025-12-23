"use client"

/**
 * MC12: Wizard de importação de planilhas
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

type ImportResult = {
  ok: boolean
  result?: {
    success: boolean
    imported: {
      transactions: number
      accounts: number
    }
    skipped: {
      duplicates: number
      errors: number
    }
    errors: Array<{
      row: number
      message: string
    }>
    warnings: Array<{
      message: string
    }>
  }
  error?: string
  details?: any
}

export function ImportWizard({
  entities,
  accounts,
  onImportComplete,
}: {
  entities: Array<{ id: string; legal_name: string; type: string }>
  accounts: Array<{ id: string; name: string; entity_id: string }>
  onImportComplete?: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [file, setFile] = useState<File | null>(null)
  const [entityId, setEntityId] = useState<string>("")
  const [accountId, setAccountId] = useState<string>("")
  const [accountName, setAccountName] = useState<string>("")
  const [accountType, setAccountType] = useState<'checking' | 'investment' | 'other'>('checking')
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [autoReconcile, setAutoReconcile] = useState(false)
  const [importing, setImporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  // Filtrar contas da entidade selecionada
  const entityAccounts = accounts.filter(acc => acc.entity_id === entityId)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        alert('Por favor, selecione um arquivo CSV (.csv)')
        return
      }
      
      // Validar tamanho (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert(`Arquivo muito grande. Tamanho máximo: 10MB. Tamanho atual: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`)
        return
      }
      
      setFile(selectedFile)
      setPreview(null)
      setPreviewing(true)
      
      // Fazer preview
      try {
        const formData = new FormData()
        formData.append("file", selectedFile)
        
        const response = await fetch("/api/import/preview", {
          method: "POST",
          body: formData,
        })
        
        const data = await response.json()
        if (data.ok) {
          setPreview(data.preview)
          setStep(2) // Preview step
        } else {
          alert(`Erro ao fazer preview: ${data.error || data.message}`)
          setFile(null)
        }
      } catch (error) {
        alert(`Erro ao fazer preview: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
        setFile(null)
      } finally {
        setPreviewing(false)
      }
    }
  }

  const handleImport = async () => {
    if (!file || !entityId) {
      alert('Selecione um arquivo e uma entidade')
      return
    }

    setImporting(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("entityId", entityId)
      if (accountId) {
        formData.append("accountId", accountId)
      }
      if (accountName) {
        formData.append("accountName", accountName)
        formData.append("accountType", accountType)
      }
      formData.append("skipDuplicates", skipDuplicates.toString())
      formData.append("autoReconcile", autoReconcile.toString())

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      })

      const data: ImportResult = await response.json()
      setResult(data)

      if (data.ok && data.result?.success) {
        setStep(3)
        if (onImportComplete) {
          onImportComplete()
        }
      }
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setEntityId("")
    setAccountId("")
    setAccountName("")
    setAccountType('checking')
    setResult(null)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Importar Planilha (CSV)</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Importe extratos bancários, cartões de crédito, investimentos e financiamentos
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Selecionar arquivo */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-sm font-medium text-gray-700">
                  Clique para selecionar ou arraste o arquivo CSV
                </span>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={previewing}
                />
              </Label>
              <p className="mt-2 text-xs text-gray-500">
                Formatos suportados: CSV (.csv) - Máximo 10MB
              </p>
              {previewing && (
                <p className="mt-2 text-sm text-blue-600">
                  Analisando arquivo...
                </p>
              )}
            </div>
            {file && !previewing && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                <span>{file.name}</span>
                <span className="text-gray-400">({(file.size / 1024).toFixed(2)} KB)</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Preview e Configuração */}
        {step === 2 && preview && (
          <div className="space-y-4">
            {entities.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  ⚠️ Nenhuma entidade cadastrada
                </p>
                <p className="text-sm text-yellow-700 mb-3">
                  Você precisa criar uma entidade (Pessoa Física ou Pessoa Jurídica) antes de importar planilhas.
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
                <div className="space-y-4">
            {/* Preview */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium mb-2">Preview do Arquivo</h3>
              <div className="text-sm text-gray-600 mb-3">
                <p>Total de linhas: {preview.metadata.totalRows}</p>
                <p>Linhas válidas: {preview.metadata.validRows}</p>
                <p>Linhas com erro: {preview.metadata.invalidRows}</p>
                <p>Formato detectado: {preview.metadata.detectedFormat}</p>
              </div>
              
              {preview.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs border">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="border p-2">Data</th>
                        <th className="border p-2">Descrição</th>
                        <th className="border p-2">Valor</th>
                        <th className="border p-2">Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row: any, idx: number) => (
                        <tr key={idx} className={row.validationErrors ? 'bg-yellow-50' : ''}>
                          <td className="border p-2">{row.date}</td>
                          <td className="border p-2">{row.description.substring(0, 40)}...</td>
                          <td className="border p-2">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.amount)}
                          </td>
                          <td className="border p-2">{row.type === 'income' ? 'Receita' : 'Despesa'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {preview.errors.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 rounded text-xs">
                  <p className="font-medium text-red-800 mb-1">Erros encontrados:</p>
                  <ul className="list-disc list-inside text-red-600 space-y-1">
                    {preview.errors.map((err: any, idx: number) => (
                      <li key={idx}>Linha {err.row}: {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {preview.metadata.hasMoreRows && (
                <p className="mt-2 text-xs text-gray-500">
                  ... e mais {preview.metadata.totalRows - 10} linhas
                </p>
              )}
            </div>
            
                {/* Configuração */}
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-4">Configuração da Importação</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="entity">Entidade *</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Selecione a entidade (PF ou PJ) à qual estas transações pertencem
                      </p>
                      <Select value={entityId} onValueChange={setEntityId}>
                        <SelectTrigger id="entity">
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
                      <Label htmlFor="account">Conta (opcional)</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Selecione uma conta existente ou deixe vazio para criar automaticamente
                      </p>
                      <Select 
                        value={accountId || undefined} 
                        onValueChange={(v) => setAccountId(v === "__none__" ? "" : v)}
                        disabled={!entityId}
                      >
                        <SelectTrigger id="account">
                          <SelectValue placeholder={entityId ? "Selecione a conta (opcional)" : "Selecione primeiro a entidade"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma (criar automaticamente)</SelectItem>
                          {entityAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {!accountId && entityId && (
              <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                <Label htmlFor="accountName">Nome da nova conta (se não existir)</Label>
                <Input
                  id="accountName"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Ex: Conta Corrente BB"
                />
                <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="investment">Investimento</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                />
                <span>Pular transações duplicadas (recomendado)</span>
              </Label>
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoReconcile}
                  onChange={(e) => setAutoReconcile(e.target.checked)}
                />
                <span>Conciliação automática com schedules/commitments</span>
              </Label>
            </div>

                    <div className="flex gap-2 pt-4">
                      <Button variant="outline" onClick={() => { setStep(1); setPreview(null) }}>
                        Voltar
                      </Button>
                      <Button
                        onClick={handleImport}
                        disabled={!entityId || importing}
                        className="flex-1"
                      >
                        {importing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          "Importar"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Resultado */}
        {step === 3 && result && (
          <div className="space-y-4">
            {result.ok && result.result?.success ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Importação concluída com sucesso!</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {result.result.imported.transactions}
                    </div>
                    <div className="text-sm text-gray-600">Transações importadas</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {result.result.imported.accounts}
                    </div>
                    <div className="text-sm text-gray-600">Contas criadas</div>
                  </div>
                </div>

                {result.result.skipped.duplicates > 0 && (
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="text-sm text-yellow-800">
                      {result.result.skipped.duplicates} transações duplicadas foram puladas
                    </div>
                  </div>
                )}

                {result.result.errors.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-sm font-medium text-red-800 mb-2">
                      {result.result.errors.length} erros encontrados:
                    </div>
                    <div className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                      {result.result.errors.slice(0, 10).map((err, idx) => (
                        <div key={idx}>
                          Linha {err.row}: {err.message}
                        </div>
                      ))}
                      {result.result.errors.length > 10 && (
                        <div>... e mais {result.result.errors.length - 10} erros</div>
                      )}
                    </div>
                  </div>
                )}

                {result.result.warnings.length > 0 && (
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="text-sm font-medium text-yellow-800 mb-2">Avisos:</div>
                    <div className="text-xs text-yellow-600 space-y-1">
                      {result.result.warnings.map((warn, idx) => (
                        <div key={idx}>{warn.message}</div>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={handleReset} className="w-full">
                  Importar outro arquivo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Erro na importação</span>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-800">
                    {result.error || "Erro desconhecido"}
                  </div>
                  {result.details && (
                    <div className="mt-2 text-xs text-red-600">
                      {JSON.stringify(result.details, null, 2)}
                    </div>
                  )}
                </div>
                <Button onClick={handleReset} variant="outline" className="w-full">
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

