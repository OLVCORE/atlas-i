/**
 * MC11: Funções para parsing e detecção de padrões em transações do Pluggy
 * 
 * Detecta parcelas, agrupa compras, identifica merchants
 */

/**
 * Detecta se uma descrição contém informação de parcela
 * 
 * Padrões suportados:
 * - "PARCELA 1/3"
 * - "PARC 2 DE 5"
 * - "1/10"
 * - "PARCELA 1 DE 3"
 */
export function parseInstallmentInfo(description: string): {
  isInstallment: boolean
  currentInstallment?: number
  totalInstallments?: number
  merchant?: string
  cleanDescription?: string
} {
  if (!description) {
    return { isInstallment: false }
  }

  const upperDesc = description.toUpperCase().trim()
  
  // Padrão 1: "PARCELA 1/3" ou "PARC 1/3"
  const pattern1 = /PARC(ELA)?\s*(\d+)\s*\/\s*(\d+)/i
  const match1 = description.match(pattern1)
  if (match1) {
    const current = parseInt(match1[2], 10)
    const total = parseInt(match1[3], 10)
    const merchant = description.replace(pattern1, '').trim()
    
    return {
      isInstallment: true,
      currentInstallment: current,
      totalInstallments: total,
      merchant: merchant || undefined,
      cleanDescription: merchant || description,
    }
  }

  // Padrão 2: "PARCELA 1 DE 3" ou "PARC 2 DE 5"
  const pattern2 = /PARC(ELA)?\s*(\d+)\s*DE\s*(\d+)/i
  const match2 = description.match(pattern2)
  if (match2) {
    const current = parseInt(match2[2], 10)
    const total = parseInt(match2[3], 10)
    const merchant = description.replace(pattern2, '').trim()
    
    return {
      isInstallment: true,
      currentInstallment: current,
      totalInstallments: total,
      merchant: merchant || undefined,
      cleanDescription: merchant || description,
    }
  }

  // Padrão 3: "1/3" no início ou fim
  const pattern3 = /^(\d+)\/(\d+)\s*(.+)$|^(.+?)\s*(\d+)\/(\d+)$/
  const match3 = description.match(pattern3)
  if (match3) {
    const current = parseInt(match3[1] || match3[5], 10)
    const total = parseInt(match3[2] || match3[6], 10)
    const merchant = (match3[3] || match3[4] || '').trim()
    
    if (current > 0 && total > 0 && current <= total) {
      return {
        isInstallment: true,
        currentInstallment: current,
        totalInstallments: total,
        merchant: merchant || undefined,
        cleanDescription: merchant || description,
      }
    }
  }

  return { isInstallment: false }
}

/**
 * Agrupa transações que parecem ser da mesma compra parcelada
 * 
 * Critérios:
 * - Mesmo merchant (similaridade de descrição)
 * - Valores próximos (mesma parcela)
 * - Datas próximas (mesmo período)
 */
export function groupTransactionsByPurchase(
  transactions: Array<{
    id: string
    description: string
    amount: number
    date: string
  }>,
  options?: {
    amountTolerance?: number // Tolerância em centavos (padrão: 5)
    dateToleranceDays?: number // Tolerância em dias (padrão: 7)
  }
): Array<{
  purchaseId: string
  transactions: Array<{
    id: string
    description: string
    amount: number
    date: string
    installmentInfo?: {
      current: number
      total: number
    }
  }>
  totalAmount: number
  merchant?: string
  installments: number
}> {
  const amountTolerance = options?.amountTolerance ?? 5 // 5 centavos
  const dateToleranceDays = options?.dateToleranceDays ?? 7

  const groups: Map<string, {
    purchaseId: string
    transactions: Array<{
      id: string
      description: string
      amount: number
      date: string
      installmentInfo?: {
        current: number
        total: number
      }
    }>
    totalAmount: number
    merchant?: string
    installments: number
  }> = new Map()

  for (const tx of transactions) {
    const installmentInfo = parseInstallmentInfo(tx.description)
    
    if (!installmentInfo.isInstallment) {
      // Transação única, não agrupa
      continue
    }

    const { currentInstallment, totalInstallments, merchant, cleanDescription } = installmentInfo
    
    if (!currentInstallment || !totalInstallments) {
      continue
    }

    // Tentar encontrar grupo existente
    let matchedGroup: typeof groups extends Map<any, infer V> ? V : never | null = null
    
    for (const [key, group] of groups.entries()) {
      // Verificar se é a mesma compra:
      // 1. Mesmo merchant (similaridade)
      // 2. Mesmo número total de parcelas
      // 3. Valor de parcela similar
      // 4. Data próxima
      
      const groupMerchant = group.merchant || ''
      const txMerchant = merchant || cleanDescription || ''
      
      const merchantSimilar = groupMerchant.toLowerCase().includes(txMerchant.toLowerCase()) ||
                              txMerchant.toLowerCase().includes(groupMerchant.toLowerCase())
      
      if (!merchantSimilar) continue
      
      if (group.installments !== totalInstallments) continue
      
      // Verificar se já existe esta parcela no grupo
      const hasSameInstallment = group.transactions.some(
        t => t.installmentInfo?.current === currentInstallment
      )
      if (hasSameInstallment) continue
      
      // Verificar valor similar (mesma parcela deve ter valor similar)
      const avgParcelAmount = group.totalAmount / group.installments
      const amountDiff = Math.abs(tx.amount - avgParcelAmount)
      if (amountDiff > amountTolerance / 100) continue
      
      // Verificar data próxima
      const groupDates = group.transactions.map(t => new Date(t.date))
      const txDate = new Date(tx.date)
      const dateDiff = Math.min(...groupDates.map(d => Math.abs(txDate.getTime() - d.getTime())))
      const dateDiffDays = dateDiff / (1000 * 60 * 60 * 24)
      if (dateDiffDays > dateToleranceDays) continue
      
      matchedGroup = group
      break
    }

    if (matchedGroup) {
      // Adicionar ao grupo existente
      matchedGroup.transactions.push({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        installmentInfo: {
          current: currentInstallment,
          total: totalInstallments,
        },
      })
      matchedGroup.totalAmount += tx.amount
      if (merchant && !matchedGroup.merchant) {
        matchedGroup.merchant = merchant
      }
    } else {
      // Criar novo grupo
      const purchaseId = `purchase_${tx.id}_${Date.now()}`
      groups.set(purchaseId, {
        purchaseId,
        transactions: [{
          id: tx.id,
          description: tx.description,
          amount: tx.amount,
          date: tx.date,
          installmentInfo: {
            current: currentInstallment,
            total: totalInstallments,
          },
        }],
        totalAmount: tx.amount,
        merchant: merchant || cleanDescription || undefined,
        installments: totalInstallments,
      })
    }
  }

  return Array.from(groups.values())
}

/**
 * Extrai merchant de uma descrição de transação
 */
export function extractMerchant(description: string): string | null {
  if (!description) return null

  // Remover padrões comuns de parcelas
  const cleaned = description
    .replace(/PARC(ELA)?\s*\d+\s*\/\s*\d+/gi, '')
    .replace(/PARC(ELA)?\s*\d+\s*DE\s*\d+/gi, '')
    .replace(/\d+\/\d+/g, '')
    .trim()

  if (!cleaned) return null

  // Remover caracteres especiais no início/fim
  return cleaned.replace(/^[^\w]+|[^\w]+$/g, '').trim() || null
}

