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
  CardDescription,
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
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [entityId, setEntityId] = useState<string>("")
  const [accountId, setAccountId] = useState<string>("")
  const [accountName, setAccountName] = useState<string>("")
  const [accountType, setAccountType] = useState<'checking' | 'investment' | 'other'>('checking')
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [autoReconcile, setAutoReconcile] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  // Filtrar contas da entidade selecionada
  const entityAccounts = accounts.filter(acc => acc.entity_id === entityId)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        alert('Por favor, selecione um arquivo CSV (.csv)')
        return
      }
      setFile(selectedFile)
      setStep(2)
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
        <CardDescription>
          Importe extratos bancários, cartões de crédito, investimentos e financiamentos
        </CardDescription>
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
                />
              </Label>
              <p className="mt-2 text-xs text-gray-500">
                Formatos suportados: CSV (.csv)
              </p>
            </div>
            {file && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                <span>{file.name}</span>
                <span className="text-gray-400">({(file.size / 1024).toFixed(2)} KB)</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Configurar importação */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="entity">Entidade *</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger id="entity">
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
              <Label htmlFor="account">Conta (opcional)</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="account">
                  <SelectValue placeholder="Selecione uma conta existente ou deixe vazio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma (criar nova ou usar padrão)</SelectItem>
                  {entityAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!accountId && (
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
                <span>Tentar conciliar automaticamente (em desenvolvimento)</span>
              </Label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
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

