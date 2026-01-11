/**
 * Provider para buscar índices de correção do Banco Central do Brasil
 * 
 * APIs disponíveis:
 * - IPCA: https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados
 * - IGPM: https://api.bcb.gov.br/dados/serie/bcdata.sgs.189/dados
 * - CDI: https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados
 */

export type IndexType = 'IPCA' | 'IGPM' | 'CDI'

export type IndexValue = {
  date: string // YYYY-MM-DD
  value: number
}

export type IndexSeries = {
  index: IndexType
  values: IndexValue[]
}

/**
 * Códigos das séries do Banco Central:
 * - IPCA: 433
 * - IGP-M: 189
 * - CDI: 12
 */
const BCB_SERIES_CODES: Record<IndexType, number> = {
  IPCA: 433,
  IGPM: 189,
  CDI: 12,
}

/**
 * Busca valores de um índice do Banco Central para um período
 */
export async function fetchIndexValues(
  index: IndexType,
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
): Promise<IndexValue[]> {
  const seriesCode = BCB_SERIES_CODES[index]
  const startDateFormatted = startDate.split('-').reverse().join('/') // DD/MM/YYYY
  const endDateFormatted = endDate.split('-').reverse().join('/') // DD/MM/YYYY

  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados?formato=json&dataInicial=${startDateFormatted}&dataFinal=${endDateFormatted}`

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ATLAS-i/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`Erro ao buscar ${index}: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Converter formato do BCB (DD/MM/YYYY) para nosso formato (YYYY-MM-DD)
    return data.map((item: any) => ({
      date: item.data.split('/').reverse().join('-'), // DD/MM/YYYY -> YYYY-MM-DD
      value: Number(item.valor),
    }))
  } catch (error: any) {
    console.error(`[BCB] Erro ao buscar ${index}:`, error)
    throw new Error(`Erro ao buscar ${index}: ${error.message}`)
  }
}

/**
 * Busca o valor acumulado de um índice em um período
 */
export async function getIndexAccumulated(
  index: IndexType,
  startDate: string,
  endDate: string
): Promise<number> {
  const values = await fetchIndexValues(index, startDate, endDate)
  
  if (values.length === 0) {
    return 0
  }

  // Calcular fator acumulado: (1 + v1/100) * (1 + v2/100) * ... - 1
  let factor = 1
  for (const item of values) {
    factor *= (1 + item.value / 100)
  }
  
  return (factor - 1) * 100 // Retorna em percentual
}
