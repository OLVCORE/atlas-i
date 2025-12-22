import type { CnpjProvider, CnpjProviderResult } from "./types"
import { BrasilApiProvider } from "./brasilapi"

export async function fetchCnpjData(cnpj: string): Promise<CnpjProviderResult> {
  const providerName = process.env.CNPJ_PROVIDER || "brasilapi"

  let provider: CnpjProvider

  switch (providerName.toLowerCase()) {
    case "brasilapi":
      provider = new BrasilApiProvider()
      break
    default:
      throw new Error(`Provider '${providerName}' não suportado`)
  }

  return provider.fetch(cnpj)
}

export type { CnpjProvider, CnpjProviderResult }

