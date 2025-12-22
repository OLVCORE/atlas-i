# Open Finance Integration (ATLAS-i)

## Princípio Arquitetural

**"Inputs manuais mínimos"**: O sistema ATLAS-i deve receber transações automaticamente de bancos/cartões via Open Finance, reduzindo drasticamente a necessidade de entrada manual de dados.

## Fluxo de Dados (Conceitual)

1. **Ingestão Automática**
   - Conectores (Pluggy/Belvo/Open Finance direto) buscam transações periodicamente
   - Eventos de ingestão chegam como `OpenFinanceIngestEvent`

2. **Conciliação Inteligente**
   - Transações ingeridas são comparadas com schedules (cronogramas previstos)
   - Match por valor, data, descrição normalizada
   - Resultado: `ReconciliationResult` (matched/unmatched/anomaly)

3. **Alertas e Recomendações**
   - Transações não reconciliadas geram `AnomalySignal`
   - Usuário pode revisar e vincular manualmente se necessário

## Regras Fundamentais

- **Sempre respeitar**: schedules (previsto) vs ledger (realizado)
- **Nunca automação total sem governança**: usuário sempre pode revisar/desfazer
- **Auditoria completa**: toda ingestão e conciliação é logada

## Status

🟡 **Preparação (MC4.4)**: Tipos e interfaces base definidos. Implementação completa prevista para MC8.

## Arquivos

- `types.ts`: Tipos TypeScript para eventos e resultados
- `README.md`: Este arquivo

