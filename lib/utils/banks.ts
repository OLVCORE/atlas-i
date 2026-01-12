/**
 * Lista de bancos brasileiros (código + nome)
 * Baseado na lista oficial do Banco Central do Brasil
 */

export type Bank = {
  code: string
  name: string
}

export const BRAZILIAN_BANKS: Bank[] = [
  { code: "001", name: "Banco do Brasil S.A." },
  { code: "033", name: "Banco Santander (Brasil) S.A." },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "237", name: "Banco Bradesco S.A." },
  { code: "341", name: "Banco Itaú S.A." },
  { code: "356", name: "Banco Real S.A. (antigo)" },
  { code: "422", name: "Banco Safra S.A." },
  { code: "633", name: "Banco Rendimento S.A." },
  { code: "652", name: "Itaú Unibanco Holding S.A." },
  { code: "748", name: "Banco Cooperativo Sicredi S.A." },
  { code: "756", name: "Banco Cooperativo do Brasil S.A. - BANCOOB" },
  { code: "077", name: "Banco Inter S.A." },
  { code: "260", name: "Nu Pagamentos S.A. (Nubank)" },
  { code: "290", name: "Pagseguro Internet S.A." },
  { code: "323", name: "Mercado Pago - Conta do Mercado Livre" },
  { code: "380", name: "PicPay Serviços S.A." },
  { code: "332", name: "Acesso Soluções de Pagamento S.A." },
  { code: "208", name: "Banco BTG Pactual S.A." },
  { code: "212", name: "Banco Original S.A." },
  { code: "655", name: "Banco Votorantim S.A." },
  { code: "041", name: "Banco do Estado do Rio Grande do Sul S.A." },
  { code: "047", name: "Banco do Estado de Sergipe S.A." },
  { code: "062", name: "Hipercard Banco Múltiplo S.A." },
  { code: "070", name: "Banco de Brasília S.A." },
  { code: "085", name: "Cooperativa Central de Crédito - Ailos" },
  { code: "136", name: "Unicred Cooperativa Central" },
  { code: "197", name: "Stone Pagamentos S.A." },
  { code: "218", name: "Banco BS2 S.A." },
  { code: "230", name: "Banco Bandeirantes S.A." },
  { code: "265", name: "Banco Fator S.A." },
  { code: "318", name: "Banco BMG S.A." },
  { code: "336", name: "Banco C6 S.A." },
  { code: "654", name: "Banco Digimais S.A." },
  { code: "735", name: "Banco Neon S.A." },
  { code: "739", name: "Banco Cetelem S.A." },
  { code: "746", name: "Banco Modal S.A." },
  { code: "747", name: "Banco Rabobank International Brasil S.A." },
  { code: "751", name: "Scotiabank Brasil S.A. Banco Múltiplo" },
  { code: "755", name: "Bank of America Merrill Lynch Banco Múltiplo S.A." },
  { code: "102", name: "XP Investimentos CCTVM S.A." },
  { code: "250", name: "BCV - Banco de Crédito e Varejo S.A." },
  { code: "263", name: "Banco Cacique S.A." },
  { code: "280", name: "Avista S.A. Crédito, Financiamento e Investimento" },
  { code: "376", name: "Banco J.P. Morgan S.A." },
]

/**
 * Formata nome da conta padronizado com código do banco
 */
export function formatAccountName(bankCode: string | null, bankName: string | null, accountName: string): string {
  if (!bankCode || !bankName) {
    return accountName
  }
  
  // Se o nome já contém o banco, retornar como está
  if (accountName.toLowerCase().includes(bankName.toLowerCase())) {
    return accountName
  }
  
  // Formato: "Nome da Conta - Código - Banco"
  return `${accountName} - ${bankCode} - ${bankName}`
}

/**
 * Busca banco por código
 */
export function getBankByCode(code: string): Bank | undefined {
  return BRAZILIAN_BANKS.find(bank => bank.code === code)
}

/**
 * Busca banco por nome (busca parcial, case-insensitive)
 */
export function findBankByName(name: string): Bank | undefined {
  const normalizedName = name.toLowerCase().trim()
  return BRAZILIAN_BANKS.find(bank => 
    bank.name.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(bank.name.toLowerCase())
  )
}
