"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Search } from "lucide-react"
import { normalizeCnpj, validateCnpj } from "@/lib/utils/cnpj"
import { HelpTooltip } from "@/components/help/HelpTooltip"

type EntityFormData = {
  type: "PF" | "PJ"
  legalName: string
  document: string
  tradeName?: string
  registrationStatus?: string
  foundationDate?: string
  mainActivityCode?: string
  mainActivityDesc?: string
  addressStreet?: string
  addressNumber?: string
  addressComplement?: string
  addressDistrict?: string
  addressCity?: string
  addressState?: string
  addressZip?: string
  phone?: string
  email?: string
  enrichmentPayload?: any
  enrichmentProvider?: string
}

type EnrichmentData = {
  legalName?: string
  tradeName?: string
  status?: string
  statusDate?: string
  foundationDate?: string
  mainActivity?: {
    code?: string
    text?: string
  }
  mainActivityCode?: string
  mainActivityText?: string
  address?: {
    street?: string
    number?: string
    complement?: string
    district?: string
    city?: string
    state?: string
    zip?: string
  }
  phone?: string
  email?: string
  raw: any
  provider: string
}

export function EntityForm({
  onSubmit,
  initialData,
}: {
  onSubmit: (data: EntityFormData) => Promise<void>
  initialData?: {
    id?: string
    type: "PF" | "PJ"
    legalName: string
    document: string
    tradeName?: string | null
    registrationStatus?: string | null
    foundationDate?: string | null
    mainActivityCode?: string | null
    mainActivityDesc?: string | null
    addressStreet?: string | null
    addressNumber?: string | null
    addressComplement?: string | null
    addressDistrict?: string | null
    addressCity?: string | null
    addressState?: string | null
    addressZip?: string | null
    phone?: string | null
    email?: string | null
  }
}) {
  const isEditMode = !!initialData
  const [type, setType] = useState<"PF" | "PJ" | "">(initialData?.type || "")
  const [legalName, setLegalName] = useState(initialData?.legalName || "")
  const [document, setDocument] = useState(initialData?.document || "")
  const [tradeName, setTradeName] = useState(initialData?.tradeName || "")
  const [registrationStatus, setRegistrationStatus] = useState(initialData?.registrationStatus || "")
  const [foundationDate, setFoundationDate] = useState(
    initialData?.foundationDate ? initialData.foundationDate.split("T")[0] : ""
  )
  const [mainActivityCode, setMainActivityCode] = useState(initialData?.mainActivityCode || "")
  const [mainActivityDesc, setMainActivityDesc] = useState(initialData?.mainActivityDesc || "")
  const [addressStreet, setAddressStreet] = useState(initialData?.addressStreet || "")
  const [addressNumber, setAddressNumber] = useState(initialData?.addressNumber || "")
  const [addressComplement, setAddressComplement] = useState(initialData?.addressComplement || "")
  const [addressDistrict, setAddressDistrict] = useState(initialData?.addressDistrict || "")
  const [addressCity, setAddressCity] = useState(initialData?.addressCity || "")
  const [addressState, setAddressState] = useState(initialData?.addressState || "")
  const [addressZip, setAddressZip] = useState(initialData?.addressZip || "")
  const [phone, setPhone] = useState(initialData?.phone || "")
  const [email, setEmail] = useState(initialData?.email || "")

  const [loading, setLoading] = useState(false)
  const [loadingEnrichment, setLoadingEnrichment] = useState(false)
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [enrichmentPayload, setEnrichmentPayload] = useState<any>(null)
  const [enrichmentProvider, setEnrichmentProvider] = useState<string | null>(null)

  const handleDocumentChange = (value: string) => {
    setDocument(value)
    if (type === "PJ") {
      const normalized = normalizeCnpj(value)
      if (normalized.length <= 14) {
        setDocument(value)
      }
    } else {
      setDocument(value)
    }
  }

  const handleFetchEnrichment = async () => {
    if (type !== "PJ") {
      return
    }

    const validation = validateCnpj(document)
    if (!validation.valid) {
      setEnrichmentError(validation.error || "CNPJ inválido")
      return
    }

    setLoadingEnrichment(true)
    setEnrichmentError(null)

    try {
      const response = await fetch("/api/entities/enrich/cnpj", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cnpj: document }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao buscar dados")
      }

      const data: EnrichmentData = await response.json()

      // Log para debug
      console.log('[EntityForm] Dados recebidos da API:', {
        mainActivity: data.mainActivity,
        mainActivityCode: data.mainActivity?.code,
        mainActivityText: data.mainActivity?.text,
      })

      // Salvar payload e provider para auditoria
      setEnrichmentPayload(data.raw)
      setEnrichmentProvider(data.provider)

      // Preencher campos (sobrescrever se vier da API, especialmente para refresh)
      if (data.legalName) setLegalName(data.legalName)
      if (data.tradeName) setTradeName(data.tradeName)
      if (data.status) setRegistrationStatus(data.status)
      if (data.foundationDate) {
        // Formato de data para input type="date" (YYYY-MM-DD)
        const dateStr = data.foundationDate
        if (dateStr.includes("T")) {
          setFoundationDate(dateStr.split("T")[0])
        } else if (dateStr.includes("/")) {
          const [day, month, year] = dateStr.split("/")
          setFoundationDate(`${year}-${month}-${day}`)
        } else {
          setFoundationDate(dateStr)
        }
      }
      
      // Preencher código CNAE (sempre quando disponível da API)
      // Priorizar objeto mainActivity, depois campos diretos
      if (data.mainActivity) {
        if (data.mainActivity.code !== undefined && data.mainActivity.code !== null && data.mainActivity.code !== '') {
          console.log('[EntityForm] Preenchendo código CNAE:', data.mainActivity.code)
          setMainActivityCode(String(data.mainActivity.code).trim())
        }
        // Preencher descrição CNAE
        if (data.mainActivity.text !== undefined && data.mainActivity.text !== null && data.mainActivity.text !== '') {
          console.log('[EntityForm] Preenchendo descrição CNAE:', data.mainActivity.text)
          setMainActivityDesc(String(data.mainActivity.text).trim())
        }
      } else {
        // Fallback para campos diretos se mainActivity não estiver presente
        if (data.mainActivityCode !== undefined && data.mainActivityCode !== null && data.mainActivityCode !== '') {
          console.log('[EntityForm] Preenchendo código CNAE (campo direto):', data.mainActivityCode)
          setMainActivityCode(String(data.mainActivityCode).trim())
        }
        if (data.mainActivityText !== undefined && data.mainActivityText !== null && data.mainActivityText !== '') {
          console.log('[EntityForm] Preenchendo descrição CNAE (campo direto):', data.mainActivityText)
          setMainActivityDesc(String(data.mainActivityText).trim())
        }
      }
      if (data.address?.street) setAddressStreet(data.address.street)
      if (data.address?.number) setAddressNumber(data.address.number)
      if (data.address?.complement)
        setAddressComplement(data.address.complement)
      if (data.address?.district) setAddressDistrict(data.address.district)
      if (data.address?.city) setAddressCity(data.address.city)
      if (data.address?.state) setAddressState(data.address.state)
      if (data.address?.zip) setAddressZip(data.address.zip)
      if (data.phone) setPhone(data.phone)
      if (data.email) setEmail(data.email)
    } catch (error: any) {
      setEnrichmentError(error.message || "Erro ao buscar dados do CNPJ")
    } finally {
      setLoadingEnrichment(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    
    if (!type || !legalName || !document) {
      return
    }

    if (type !== "PF" && type !== "PJ") {
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        type,
        legalName,
        document,
        tradeName: tradeName || undefined,
        registrationStatus: registrationStatus || undefined,
        foundationDate: foundationDate || undefined,
        mainActivityCode: mainActivityCode || undefined,
        mainActivityDesc: mainActivityDesc || undefined,
        addressStreet: addressStreet || undefined,
        addressNumber: addressNumber || undefined,
        addressComplement: addressComplement || undefined,
        addressDistrict: addressDistrict || undefined,
        addressCity: addressCity || undefined,
        addressState: addressState || undefined,
        addressZip: addressZip || undefined,
        phone: phone || undefined,
        email: email || undefined,
        enrichmentPayload: enrichmentPayload || undefined,
        enrichmentProvider: enrichmentProvider || undefined,
      })
    } catch (error: any) {
      console.error("Erro ao salvar entidade:", error)
      setSubmitError(error.message || "Erro ao salvar entidade")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submitError && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="type">Tipo</Label>
            <HelpTooltip contentKey="entities.type" />
          </div>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "PF" | "PJ" | "")}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Selecione o tipo</option>
            <option value="PF">Pessoa Física</option>
            <option value="PJ">Pessoa Jurídica</option>
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="document">CPF/CNPJ</Label>
            <HelpTooltip contentKey="entities.document" />
          </div>
          <div className="flex gap-2">
            <Input
              id="document"
              name="document"
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              value={document}
              onChange={(e) => handleDocumentChange(e.target.value)}
              required
            />
            {type === "PJ" && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFetchEnrichment}
                  disabled={loadingEnrichment || !document}
                >
                  {loadingEnrichment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="sr-only">Buscar dados</span>
                </Button>
                <HelpTooltip contentKey="entities.cnpj_search" />
              </div>
            )}
          </div>
          {enrichmentError && (
            <p className="text-sm text-destructive">{enrichmentError}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="legalName">Nome/Razão Social</Label>
            <HelpTooltip contentKey="entities.legal_name" />
          </div>
          <Input
            id="legalName"
            name="legalName"
            placeholder="Nome completo ou razão social"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            required
          />
        </div>
      </div>

      {type === "PJ" && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-semibold">Dados Adicionais (PJ)</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tradeName">Nome Fantasia</Label>
              <Input
                id="tradeName"
                name="tradeName"
                placeholder="Nome fantasia"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationStatus">Situação Cadastral</Label>
              <Input
                id="registrationStatus"
                name="registrationStatus"
                placeholder="Situação cadastral"
                value={registrationStatus}
                onChange={(e) => setRegistrationStatus(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="foundationDate">Data de Fundação</Label>
              <Input
                id="foundationDate"
                name="foundationDate"
                type="date"
                value={foundationDate}
                onChange={(e) => setFoundationDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mainActivityCode">Código CNAE Principal</Label>
              <Input
                id="mainActivityCode"
                name="mainActivityCode"
                placeholder="Código CNAE"
                value={mainActivityCode}
                onChange={(e) => setMainActivityCode(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mainActivityDesc">Descrição CNAE Principal</Label>
              <Input
                id="mainActivityDesc"
                name="mainActivityDesc"
                placeholder="Descrição da atividade principal"
                value={mainActivityDesc}
                onChange={(e) => setMainActivityDesc(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h4 className="text-sm font-semibold">Endereço</h4>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="addressStreet">Logradouro</Label>
                <Input
                  id="addressStreet"
                  name="addressStreet"
                  placeholder="Rua, Avenida, etc"
                  value={addressStreet}
                  onChange={(e) => setAddressStreet(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressNumber">Número</Label>
                <Input
                  id="addressNumber"
                  name="addressNumber"
                  placeholder="Número"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressComplement">Complemento</Label>
                <Input
                  id="addressComplement"
                  name="addressComplement"
                  placeholder="Complemento"
                  value={addressComplement}
                  onChange={(e) => setAddressComplement(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressDistrict">Bairro</Label>
                <Input
                  id="addressDistrict"
                  name="addressDistrict"
                  placeholder="Bairro"
                  value={addressDistrict}
                  onChange={(e) => setAddressDistrict(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressCity">Cidade</Label>
                <Input
                  id="addressCity"
                  name="addressCity"
                  placeholder="Cidade"
                  value={addressCity}
                  onChange={(e) => setAddressCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressState">Estado</Label>
                <Input
                  id="addressState"
                  name="addressState"
                  placeholder="UF"
                  maxLength={2}
                  value={addressState}
                  onChange={(e) =>
                    setAddressState(e.target.value.toUpperCase())
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressZip">CEP</Label>
                <Input
                  id="addressZip"
                  name="addressZip"
                  placeholder="00000-000"
                  value={addressZip}
                  onChange={(e) => setAddressZip(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h4 className="text-sm font-semibold">Contato</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading
            ? isEditMode
              ? "Salvando..."
              : "Criando..."
            : isEditMode
            ? "Salvar Alterações"
            : "Criar Entidade"}
        </Button>
        {isEditMode && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.href = "/app/entities"
            }}
            disabled={loading}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}

