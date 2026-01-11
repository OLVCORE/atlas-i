/**
 * Módulo principal de importação de extratos
 * 
 * Orquestra todo o processo de importação:
 * 1. Detecção do parser adequado
 * 2. Parsing do extrato
 * 3. Detecção de duplicatas
 * 4. Preview e validação
 * 5. Importação final
 */

export * from './types'
export * from './parsers/base'
export * from './parsers/registry'
export * from './detectors/duplicate-detector'

// Parsers serão exportados quando implementados
// export * from './parsers/itau-checking'
// export * from './parsers/itau-credit-card'
// etc...
