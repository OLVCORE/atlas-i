# MC3 - Design: Cartões + Compras Parceladas (Agenda automática por ciclo)

## Visão Geral

O MC3 implementa o módulo de cartões de crédito por entidade (PF/PJ), com:
- `closing_day` (dia de corte / melhor dia de compra)
- `due_day` (dia de pagamento)
- Compras parceladas que geram automaticamente uma agenda de parcelas (compromissos futuros)
- Integração com Ledger para registrar parcelas como transações

## Arquitetura

### Banco de Dados

#### Tabela `cards`
Armazena os cartões de crédito vinculados a entidades.

Campos principais:
- `workspace_id`, `entity_id` (vinculação multi-tenant)
- `name` (nome do cartão, ex: "LatamPass", "XP PJ")
- `brand` (bandeira: visa/master/elo, opcional)
- `closing_day` (1-28, dia de corte)
- `due_day` (1-28, dia de pagamento)
- `is_active` (flag de ativação)

#### Tabela `card_purchases`
Armazena as compras mestre (informações da compra completa).

Campos principais:
- `workspace_id`, `entity_id`, `card_id` (vinculações)
- `purchase_date` (data da compra)
- `merchant`, `description` (informações da compra)
- `total_amount` (valor total)
- `installments` (número de parcelas)
- `first_installment_month` (mês de competência inicial, opcional)

#### Tabela `card_installments`
Armazena a agenda de parcelas (uma linha por parcela).

Campos principais:
- `workspace_id`, `entity_id`, `card_id`, `purchase_id` (vinculações)
- `installment_number` (número da parcela: 1, 2, 3...)
- `competence_month` (mês de competência - primeiro dia do mês)
- `amount` (valor da parcela)
- `status` ('scheduled', 'posted', 'canceled')
- `posted_transaction_id` (FK para transactions quando postada)

#### Tabela `card_audit_log`
Registra auditoria de ações no módulo de cartões.

### Motor de Cálculo (`lib/cards/cycle.ts`)

Funções determinísticas:

1. **`resolveStatementMonth(purchaseDate, closingDay)`**
   - Determina o mês de competência baseado na data de compra e dia de corte
   - Regra: Se dia <= closing_day => competência do mês atual, senão => mês seguinte
   - Retorna: Date com primeiro dia do mês de competência

2. **`addMonths(monthDate, n)`**
   - Adiciona n meses a uma data (mantendo primeiro dia do mês)

3. **`generateInstallments(total, installments)`**
   - Divide valor total em N parcelas
   - Distribui centavos justamente: as primeiras parcelas recebem +1 centavo se houver resto
   - Garante soma exata

### Bibliotecas de Negócio

#### `lib/cards/purchases.ts`
- `createCard()` - Cria novo cartão
- `listCards()` - Lista cartões do workspace
- `listCardsByEntity()` - Lista cartões de uma entidade
- `createCardPurchaseAndSchedule()` - Cria compra e gera parcelas automaticamente

#### `lib/cards/installments.ts`
- `listInstallmentsByCardAndPeriod()` - Lista parcelas por cartão e período
- `listInstallmentsByEntityAndPeriod()` - Lista parcelas por entidade e período
- `postInstallmentToLedger()` - Posta parcela no ledger (cria transaction)

### Interface de Usuário

#### `/app/cards`
- Formulário para criar novo cartão
- Tabela listando cartões cadastrados
- Estados vazios: "Sem cartões cadastrados no workspace."

#### `/app/purchases`
- Formulário para registrar nova compra
- Campos: Entity, Card, Data, Merchant, Descrição, Total, Parcelas, Mês inicial (opcional)
- Após criar, mostra mensagem de sucesso

#### `/app/installments`
- Tabela com agenda de parcelas
- Filtros: Entity, Card, Período (mês inicial/final), Status
- Total por mês (somatório) no topo
- Ação "Registrar no Ledger" para parcelas agendadas
- Modal para selecionar conta e descrição ao postar

### Integração com Ledger

Ao postar uma parcela:
1. Cria transaction tipo `expense` (valor negativo)
2. Data: calculada usando `due_day` do cartão no mês de competência
3. Descrição: usa merchant/description da compra ou descrição informada
4. Vincula `posted_transaction_id` na parcela
5. Marca status como 'posted'

### RLS (Row Level Security)

Todas as tabelas do MC3 seguem o padrão multi-tenant:
- SELECT: apenas membros do workspace
- INSERT: apenas membros do workspace + validação de relacionamentos
- UPDATE: apenas membros do workspace + não permite trocar workspace_id
- DELETE: apenas membros do workspace

Policies não usam recursão (consultam workspace_members diretamente).

### Fluxo de Uso

1. **Criar Cartão**: Usuário cadastra cartão com closing_day e due_day
2. **Registrar Compra**: Usuário registra compra parcelada
3. **Geração Automática**: Sistema calcula competência inicial e gera N parcelas
4. **Visualizar Agenda**: Usuário visualiza parcelas por período
5. **Postar Parcela**: Usuário posta parcela no ledger quando ocorrer o pagamento real

### Considerações

- Mês de competência é sempre o primeiro dia do mês (padronizado)
- Distribuição de centavos garante soma exata
- Integração com Ledger é manual (usuário decide quando postar)
- Não há automação bancária (MC3 é focado em planejamento e controle manual)

