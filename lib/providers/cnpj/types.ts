export type CnpjProviderResult = {
  legalName?: string
  tradeName?: string
  status?: string
  statusDate?: string
  foundationDate?: string
  mainActivity?: {
    code?: string
    text?: string
  }
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

export interface CnpjProvider {
  fetch(cnpj: string): Promise<CnpjProviderResult>
}

