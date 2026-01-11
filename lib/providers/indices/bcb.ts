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

  // Validar que as datas não são futuras (BCB não tem dados futuros)
  const today = new Date()
  const startDateObj = new Date(startDate + 'T00:00:00')
  const endDateObj = new Date(endDate + 'T00:00:00')
  
  if (startDateObj > today) {
    throw new Error(`Data inicial não pode ser futura. Use uma data até ${today.toISOString().split('T')[0]}`)
  }
  
  if (endDateObj > today) {
    // Se endDate for futura, usar hoje como limite
    const todayFormatted = today.toISOString().split('T')[0].split('-').reverse().join('/')
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados?formato=json&dataInicial=${startDateFormatted}&dataFinal=${todayFormatted}`
    return fetchFromBCB(url, index)
  }

  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados?formato=json&dataInicial=${startDateFormatted}&dataFinal=${endDateFormatted}`
  return fetchFromBCB(url, index)
}

async function fetchFromBCB(url: string, index: IndexType): Promise<IndexValue[]> {
  try {
    console.log(`[BCB] Buscando ${index}: ${url}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ATLAS-i/1.0',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      console.error(`[BCB] Erro HTTP ${response.status}:`, errorText)
      throw new Error(`Erro ao buscar ${index}: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    
    if (!Array.isArray(data)) {
      console.error(`[BCB] Resposta inválida (não é array):`, data)
      throw new Error(`Resposta inválida da API do Banco Central`)
    }

    if (data.length === 0) {
      console.warn(`[BCB] Nenhum dado encontrado para ${index} no período`)
      return []
    }

    // Converter formato do BCB (DD/MM/YYYY) para nosso formato (YYYY-MM-DD)
    return data.map((item: any) => {
      if (!item.data || item.valor === undefined) {
        console.warn(`[BCB] Item inválido:`, item)
        return null
      }
      return {
        date: item.data.split('/').reverse().join('-'), // DD/MM/YYYY -> YYYY-MM-DD
        value: Number(item.valor),
      }
    }).filter((item: any) => item !== null) as IndexValue[]
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout ao buscar ${index} do Banco Central`)
    }
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
    // Se não houver dados, retornar 0 mas avisar
    console.warn(`[BCB] Nenhum valor encontrado para ${index} entre ${startDate} e ${endDate}`)
    return 0
  }

  // Para IPCA e IGP-M, os valores já vêm em percentual mensal
  // Calcular fator acumulado: (1 + v1/100) * (1 + v2/100) * ... - 1
  let factor = 1
  for (const item of values) {
    if (isNaN(item.value)) {
      console.warn(`[BCB] Valor inválido ignorado:`, item)
      continue
    }
    factor *= (1 + item.value / 100)
  }
  
  const accumulated = (factor - 1) * 100 // Retorna em percentual
  
  console.log(`[BCB] ${index} acumulado: ${accumulated.toFixed(2)}% (${values.length} valores)`)
  
  return accumulated
}
