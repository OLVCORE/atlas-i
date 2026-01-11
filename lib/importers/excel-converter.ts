/**
 * Conversor de arquivos Excel (XLS, XLSX) para CSV
 */

// Importação dinâmica para evitar problemas no Next.js
let XLSX: any
try {
  XLSX = require('xlsx')
} catch (requireError) {
  console.error('[excel-converter] Erro ao carregar xlsx:', requireError)
  throw new Error('Biblioteca xlsx não encontrada. Execute: npm install xlsx')
}

/**
 * Converte um arquivo Excel (buffer) para string CSV
 */
export function convertExcelToCSV(fileBuffer: ArrayBuffer, fileName: string): string {
  try {
    if (!XLSX || !XLSX.read) {
      throw new Error('Biblioteca xlsx não está disponível')
    }
    
    // Converter ArrayBuffer para Buffer/Uint8Array se necessário
    let buffer: any = fileBuffer
    if (fileBuffer instanceof ArrayBuffer) {
      buffer = new Uint8Array(fileBuffer)
    }
    
    // Ler o workbook do Excel
    const workbook = XLSX.read(buffer, { type: 'array' })
    
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Arquivo Excel inválido ou vazio')
    }
    
    // Pegar a primeira planilha (sheet)
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    
    if (!worksheet) {
      throw new Error('Planilha vazia ou inválida')
    }
    
    // Converter para CSV
    const csv = XLSX.utils.sheet_to_csv(worksheet, {
      blankrows: false, // Não incluir linhas vazias
    })
    
    if (!csv || csv.trim().length === 0) {
      throw new Error('Planilha não contém dados válidos')
    }
    
    return csv
  } catch (error) {
    console.error('[excel-converter] Erro detalhado:', error)
    throw new Error(`Erro ao converter Excel para CSV: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}

/**
 * Detecta se um arquivo é Excel baseado no nome ou tipo MIME
 */
export function isExcelFile(fileName: string, mimeType?: string): boolean {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  const excelExtensions = ['.xls', '.xlsx', '.xlsm']
  
  if (excelExtensions.includes(extension)) {
    return true
  }
  
  const excelMimeTypes = [
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
  ]
  
  if (mimeType && excelMimeTypes.includes(mimeType)) {
    return true
  }
  
  return false
}
