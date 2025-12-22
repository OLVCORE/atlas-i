# MC2 - Design e Decisões Técnicas

## Visão Geral

MC2 implementa o **Core Financeiro Mínimo** do sistema ATLAS-i, estabelecendo as bases para todo o sistema financeiro.

## Modelo de Dados

### 1. Entities (Entidades)

**Propósito:** Representar pessoas físicas (PF) e pessoas jurídicas (PJ) que possuem contas e transações.

**Estrutura:**
- `id` (uuid): Identificador único
- `workspace_id` (uuid): Workspace ao qual pertence
- `type` ('PF' | 'PJ'): Tipo da entidade
- `legal_name` (text): Nome completo ou razão social
- `document` (text): CPF ou CNPJ (sem validação no MC2)
- `created_at` (timestamptz): Data de criação

**Regras:**
- Uma entidade pertence a um único workspace
- Um workspace pode ter múltiplas entities
- Nenhuma entity cruza workspaces (RLS garante)

**Decisões de Design:**
- Documento como string simples (validação e formatação virão depois)
- Sem campos adicionais (endereço, telefone, etc.) por enquanto
- Tipo restrito a PF ou PJ via CHECK constraint

---

### 2. Accounts (Contas)

**Propósito:** Representar contas financeiras (corrente, investimento, poupança) vinculadas a uma entidade.

**Estrutura:**
- `id` (uuid): Identificador único
- `workspace_id` (uuid): Workspace ao qual pertence
- `entity_id` (uuid): Entidade proprietária da conta
- `name` (text): Nome da conta
- `type` ('checking' | 'investment' | 'other'): Tipo da conta
- `currency` (text): Moeda (default: 'BRL')
- `opening_balance` (numeric 15,2): Saldo inicial
- `opening_balance_date` (date): Data do saldo inicial
- `created_at` (timestamptz): Data de criação

**Regras:**
- Uma conta pertence a uma única entity
- Uma account pertence a um único workspace
- `opening_balance` é o ponto zero do ledger
- Sem cartão no MC2 (cartões só no MC3)

**Decisões de Design:**
- Saldo inicial permite valores negativos (contas com saldo devedor)
- `opening_balance_date` permite definir uma data de referência
- Moeda como string (suporte multi-moeda básico)
- Type restrito via CHECK constraint

---

### 3. Transactions (Ledger)

**Propósito:** Registrar TODAS as transações financeiras. Tudo é lançamento no ledger.

**Estrutura:**
- `id` (uuid): Identificador único
- `workspace_id` (uuid): Workspace ao qual pertence
- `entity_id` (uuid): Entidade da transação
- `account_id` (uuid, nullable): Conta específica (opcional)
- `type` ('income' | 'expense' | 'transfer'): Tipo da transação
- `amount` (numeric 15,2): Valor da transação
- `currency` (text): Moeda (default: 'BRL')
- `date` (date): Data da transação
- `description` (text): Descrição da transação
- `created_at` (timestamptz): Data de criação

**Regras:**
- Toda transação pertence a um workspace
- Toda transação pertence a uma entity
- `account_id` é opcional (transação pode não estar vinculada a conta específica)
- `amount` é sempre positivo (despesas são negativas via código)
- Transfers ainda são simples (sem tabela própria, sem rastreamento de origem/destino)

**Decisões de Design:**
- **Amount:** Armazenado como valor absoluto positivo. A lógica de negatividade para despesas é aplicada no código (expense = -Math.abs(amount))
- **Transfers:** Simplificados no MC2. Não há rastreamento de conta origem/destino ainda
- Sem categorias no MC2
- Sem centros de custo no MC2
- Sem projetos no MC2
- `account_id` nullable permite transações sem conta específica

---

## RLS (Row Level Security)

### Estratégia Base

Todas as policies seguem o padrão:

```sql
workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
)
```

**Por que isso funciona:**
- Consulta `workspace_members` que já tem policy simples (user_id = auth.uid())
- Não cria recursão porque workspace_members não consulta outras tabelas na policy SELECT
- Garante isolamento total entre workspaces

### Policies Implementadas

**Entities:**
- SELECT, INSERT, UPDATE, DELETE: Apenas membros do workspace

**Accounts:**
- SELECT, UPDATE, DELETE: Apenas membros do workspace
- INSERT: Adicionalmente valida que entity_id pertence ao workspace

**Transactions:**
- SELECT, UPDATE, DELETE: Apenas membros do workspace
- INSERT: Adicionalmente valida que entity_id e account_id (se não null) pertencem ao workspace

---

## Backend (Server-Side)

### Funções Criadas

**lib/entities.ts:**
- `listEntities()`: Lista todas as entities do workspace
- `createEntity()`: Cria nova entity

**lib/accounts.ts:**
- `listAccountsByEntity()`: Lista contas de uma entity
- `listAllAccounts()`: Lista todas as contas do workspace
- `createAccount()`: Cria nova conta

**lib/transactions.ts:**
- `listTransactionsByAccount()`: Lista transações de uma conta
- `listTransactionsByEntity()`: Lista transações de uma entity
- `createTransaction()`: Cria nova transação (aplica sinal negativo para despesas)

**Todas as funções:**
- Usam `getOrCreateWorkspace()` para garantir workspace válido
- Filtram por workspace_id automaticamente
- Lançam erros descritivos em caso de falha

---

## Frontend (UI)

### Páginas Criadas

**/app/entities:**
- Formulário para criar entity (tipo, nome, documento)
- Tabela listando todas as entities
- Estado vazio quando não há entities

**/app/accounts:**
- Formulário para criar account (entity, nome, tipo, saldo inicial)
- Tabela listando todas as accounts com informações da entity
- Estado vazio quando não há accounts

**/app/ledger:**
- Formulário para criar transaction (entity, conta opcional, tipo, valor, data, descrição)
- Tabela listando todas as transactions
- Cores diferentes para receitas (verde) e despesas (vermelho)
- Estado vazio quando não há transactions

**Navegação:**
- Menu no header com links para todas as páginas
- Página inicial (/app) com cards de navegação rápida

---

## Limitações Intencionais (MC2)

### O que NÃO foi implementado:

1. **Cartões:** Apenas contas básicas. Cartões virão no MC3
2. **Parcelamentos:** Transações simples, sem parcelas
3. **Contratos:** Não há ainda
4. **Recebíveis:** Não há ainda
5. **Projetos/Eventos:** Não há ainda
6. **Categorias:** Transações sem categorização
7. **Centros de Custo:** Não há ainda
8. **Reconciliação:** Não há ainda
9. **Transferências Complexas:** Apenas tipo 'transfer' simples
10. **Validações Avançadas:** CPF/CNPJ não validados
11. **Multi-moeda:** Suporte básico (campo currency), sem conversão
12. **Relatórios/Dashboards:** Apenas listas básicas
13. **Edição/Exclusão:** Apenas criação e listagem
14. **Filtros/Busca:** Não há ainda

### Por que essas limitações:

- **Foco no Core:** MC2 estabelece apenas o mínimo viável para registrar transações
- **Complexidade Progressiva:** Cada MC adiciona camadas de complexidade
- **Validação Incremental:** Melhor validar o básico antes de adicionar features

---

## Decisões Técnicas Importantes

### 1. Amount em Transactions

**Decisão:** Amount sempre positivo, sinal aplicado via código.

**Razão:** 
- Simplifica queries e cálculos
- Evita inconsistências (valores positivos/negativos misturados)
- Lógica clara: expense = negativo, income = positivo, transfer = depende

### 2. Account_id Nullable

**Decisão:** Transações podem não ter conta específica.

**Razão:**
- Permite registrar transações genéricas
- Não força vinculação a conta quando não aplicável
- Facilita migração de dados futuros

### 3. RLS Baseado em Workspace Members

**Decisão:** Todas as policies usam a mesma estratégia (consulta workspace_members).

**Razão:**
- Consistência
- Performance (índice em workspace_members.user_id)
- Simplicidade de manutenção

### 4. Sem Validação de CPF/CNPJ

**Decisão:** Documento como string simples.

**Razão:**
- MC2 foca no core funcional
- Validação pode ser adicionada depois sem quebrar dados existentes
- Permite formatos diferentes durante migração

---

## Próximos Microciclos

**MC3:** Cartões + Parceladas
**MC4:** Contratos + Recebíveis
**MC5:** Projetos/Eventos
**MC6:** Cockpit Executivo
**MC7:** IA
**MC8:** Open Finance

---

## Arquivos Criados/Modificados

### Migrations
- `supabase/migrations/20251220_000002_mc2_core.sql`

### Types
- `types/database.types.ts` (atualizado)

### Lib (Server-Side)
- `lib/entities.ts`
- `lib/accounts.ts`
- `lib/transactions.ts`

### UI Components
- `components/ui/table.tsx`
- `components/ui/card.tsx`
- `components/ui/select.tsx`

### Pages
- `app/app/entities/page.tsx`
- `app/app/accounts/page.tsx`
- `app/app/ledger/page.tsx`
- `app/app/layout.tsx` (atualizado com navegação)
- `app/app/page.tsx` (atualizado com cards de navegação)

### Package
- `package.json` (adicionado @radix-ui/react-select)

