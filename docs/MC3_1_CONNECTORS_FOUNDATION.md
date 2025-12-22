# MC3.1 - Connectors Foundation: Base para Ingestão Automática

## Objetivo

Preparar a arquitetura de conectores para ingestão automática de transações bancárias e de cartões, sem necessidade de CSV. Esta é a **fundação** que será ativada no MC8 com credenciais reais de provedores (Pluggy/Belvo/Open Finance direto).

## O que foi implementado

### 1. Banco de Dados (Migration)

**Arquivo:** `supabase/migrations/20251221_000005_mc3_1_connectors_foundation.sql`

**Tabelas criadas:**
- `providers` - Provedores de dados (agregadores/Open Finance)
- `connections` - Conexões entre entidades e provedores
- `external_accounts` - Contas externas descobertas
- `external_account_map` - Mapeamento external -> internal (account/card)
- `external_transactions` - Transações ingeridas
- `sync_runs` - Execuções de sincronização
- `reconciliation_links` - Links de conciliação entre transações externas e internas
- `connectors_audit_log` - Auditoria de ações
- `card_templates` - Templates de cartões (seed com issuers comuns)

**RLS:** Todas as tabelas com políticas sem recursão, seguindo padrão MC1/MC2/MC3.

### 2. Bibliotecas (lib/connectors/)

- **normalize.ts** - Normalização de descrições de transações para matching
- **providers.ts** - Gerenciamento de providers
- **connections.ts** - Gerenciamento de conexões
- **external-accounts.ts** - Gerenciamento de contas externas e mapeamento
- **external-transactions.ts** - Inserção/atualização de transações externas (deduplicação)
- **reconciliation.ts** - Lógica de matching e conciliação
- **sync.ts** - Orquestração de sincronização (sem chamadas externas reais ainda)

### 3. Interface (/app/connections)

Página funcional que:
- Lista conexões existentes
- Permite criar providers
- Permite criar conexões (status: connecting)
- Botão "Sincronizar agora" (cria sync_run, mas não faz chamada externa)
- Exibe estado quando credenciais não estão configuradas

### 4. Melhorias no Cadastro

**Busca CNPJ:** Já implementada no MC2.1, funcionalidade mantida.

**Templates de Cartões:**
- Tabela `card_templates` com seed de issuers comuns
- Combobox em `/app/cards` para seleção de template
- Preenche automaticamente nome, bandeira e dias sugeridos
- Opção "Personalizado" para criar sem template

## Variáveis de Ambiente

Adicionar ao `.env.local` (não commitar):

```env
# Connectors (MC8 - ainda não usado no MC3.1)
CONNECTORS_PROVIDER=pluggy|belvo|openfinance_direct
CONNECTORS_ENV=sandbox|prod
CONNECTORS_CLIENT_ID=
CONNECTORS_CLIENT_SECRET=
CONNECTORS_WEBHOOK_SECRET=

# BrasilAPI (já em uso)
CNPJ_PROVIDER=brasilapi
BRASILAPI_BASE_URL=https://brasilapi.com.br
```

**IMPORTANTE:** No MC3.1, essas variáveis não são usadas ainda. A UI detecta se há `CONNECTORS_CLIENT_ID` configurado para mostrar estado apropriado.

## Fluxo Atual (MC3.1)

1. Usuário acessa `/app/connections`
2. Se não há credenciais: exibe instrução técnica
3. Se há credenciais (futuro MC8): permite criar conexão
4. Criar conexão marca status como "connecting"
5. "Sincronizar agora" cria sync_run mas não faz chamada externa

## Como validar

1. Executar migration no Supabase
2. Acessar `/app/connections` - deve exibir "Conectores não configurados"
3. Criar provider (tipo agregador ou open_finance_direct)
4. Criar conexão vinculada a uma entidade
5. Verificar que sync_run é criado ao clicar "Sincronizar agora"
6. Verificar templates em `/app/cards` - combobox deve aparecer

## Integração com MC8

No MC8, quando credenciais reais forem configuradas:
1. `sync.ts` receberá um "fetcher" abstrato do provedor real
2. Chamadas externas serão feitas via SDK do provedor
3. `external_accounts` serão populadas automaticamente
4. `external_transactions` serão ingeridas
5. Mapeamento e conciliação estarão prontos para uso

## Arquivos Criados/Alterados

### Migrations
- `supabase/migrations/20251221_000005_mc3_1_connectors_foundation.sql`

### Libraries
- `lib/connectors/normalize.ts`
- `lib/connectors/providers.ts`
- `lib/connectors/connections.ts`
- `lib/connectors/external-accounts.ts`
- `lib/connectors/external-transactions.ts`
- `lib/connectors/reconciliation.ts`
- `lib/connectors/sync.ts`

### Pages
- `app/app/connections/page.tsx`

### Components
- `components/connections-list-client.tsx`
- `components/card-form-client.tsx` (melhoria)

### APIs
- `app/api/cards/templates/route.ts`

### Documentation
- `docs/MC3_1_CONNECTORS_FOUNDATION.md` (este arquivo)

## Próximos Passos (MC8)

1. Configurar credenciais reais no vault
2. Implementar fetcher concreto para provedor escolhido
3. Integrar SDK do provedor
4. Ativar sincronização real
5. Implementar webhooks (se suportado)

## Status

✅ **MC3.1 COMPLETO**

Fundação pronta. Sistema funcional sem dados externos. Pronto para MC8 ativar com credenciais reais.

---

# MC3.1b — Provider Catalog + Wizard

## Objetivo

Aprimorar MC3.1 com:
1. **Provider Catalog (global)** + Provider Config (por workspace)
2. **Wizard** para reduzir fricção no cadastro
3. **Validação de variáveis** sem vazar segredos
4. **Auditoria** visível na UI

## O que foi implementado

### 1. Migration Provider Catalog

**Arquivo:** `supabase/migrations/20251221_000006_mc3_1b_provider_catalog.sql`

**Alterações:**
- Nova tabela `provider_catalog` (global, sem workspace_id)
  - Seed com: pluggy, belvo, openfinance_direct
  - Campos: code, name, kind, homepage, docs_url
- Ajuste na tabela `providers`:
  - Adicionada coluna `catalog_id` (FK para provider_catalog)
  - `providers` agora é "Provider Config do Workspace"
- RLS: `provider_catalog` com leitura para authenticated users

### 2. Novas Bibliotecas

- **lib/connectors/catalog.ts** - Gerenciamento do catálogo global
  - `listProviderCatalog()` - Lista providers disponíveis
  - `getProviderCatalogByCode()` - Busca por código
- **lib/connectors/env.ts** - Validação de variáveis
  - `getEnvStatus()` - Retorna apenas flags booleanas (nunca valores)

### 3. Ajustes em Bibliotecas Existentes

- **lib/connectors/providers.ts**:
  - `createProviderConfig()` - Agora recebe `catalogId` (não cria provider do zero)
  - `listProviders()` - Inclui dados do catálogo (catalog_code, catalog_name)
- **lib/connectors/connections.ts**:
  - `createConnection()` - Continua recebendo `providerConfigId` (providers.id)
- **lib/connectors/sync.ts**:
  - `listAuditLogs()` - Nova função para listar últimos N eventos

### 4. UI Refatorada (/app/connections)

**Componente:** `components/connections-wizard-client.tsx`

**Layout em 3 blocos:**

1. **Status do Ambiente (Cards):**
   - Credenciais detectadas: Sim/Não (com botão "Validar variáveis")
   - Provider selecionado
   - Conexões ativas: N
   - Último sync: ...

2. **Wizard (Passos):**
   - **Passo 1:** Escolher Provider do catálogo (combobox com busca)
   - **Passo 2:** Criar Config do Workspace (status inicial: inactive)
   - **Passo 3:** Criar Connection (entity + provider_config)
   - Lista de providers e conexões configuradas

3. **Auditoria:**
   - Tabela com últimos 20 eventos
   - Filtro por connection/resource
   - Exibe: data/hora, ação, tipo de recurso, ID, metadados

**Server Actions:**
- `validateEnvAction()` - Retorna status de env vars (apenas flags)
- `createProviderConfigAction()` - Cria provider config do workspace
- `createConnectionAction()` - Cria connection
- `updateProviderStatusAction()` - Ativa/desativa provider
- `syncConnectionAction()` - Sincroniza (apenas se connection.status='active')

### 5. Validação de Variáveis

**Botão "Validar variáveis do ambiente":**
- Server Action que chama `getEnvStatus()`
- Retorna JSON com flags:
  - `hasProvider`, `hasEnv`, `hasClientId`, `hasClientSecret`, `hasWebhook`
- Exibe apenas true/false, **nunca valores reais**

### 6. Sincronização

**Botão "Sincronizar agora":**
- Só habilitado se `connection.status === 'active'`
- Caso contrário: mensagem "Ative a conexão para sincronizar."

## Como validar (MC3.1b)

1. Executar migration `20251221_000006_mc3_1b_provider_catalog.sql`
2. Acessar `/app/connections`
3. Verificar cards de status (Credenciais, Provider, Conexões, Último Sync)
4. Clicar em "Validar variáveis" - deve mostrar flags true/false
5. Testar wizard:
   - Passo 1: Selecionar provider do catálogo (Pluggy, Belvo, etc.)
   - Passo 2: Criar configuração (status inativo por padrão)
   - Passo 3: Criar connection vinculada a entidade
6. Ativar provider e tentar sincronizar (só funciona se ativo)
7. Verificar auditoria: últimos 20 eventos devem aparecer

## Conexão com MC8 (plug-in do SDK)

A arquitetura está preparada para MC8:

1. **Provider Catalog** separa o "catálogo global" da "config do workspace"
   - MC8 apenas adiciona novos providers ao catálogo (seed) se necessário

2. **Provider Config** (`providers` table) já tem campo `config` (JSONB)
   - MC8 pode armazenar metadados não sensíveis (env, base_url)
   - Segredos continuam apenas em env vars

3. **Sync.ts** está pronto para receber "fetcher" abstrato:
   ```typescript
   // Exemplo futuro (MC8)
   async function syncWithProvider(connectionId: string, fetcher: ProviderFetcher) {
     const accounts = await fetcher.fetchAccounts()
     const transactions = await fetcher.fetchTransactions()
     // ... inserir em external_accounts, external_transactions
   }
   ```

4. **Validação de env** já existe - MC8 só precisa garantir que variáveis estão configuradas

5. **Auditoria** já registra tudo - MC8 apenas continuará o padrão

## Arquivos Criados/Alterados (MC3.1b)

### Migrations
- `supabase/migrations/20251221_000006_mc3_1b_provider_catalog.sql` (NOVO)

### Libraries
- `lib/connectors/catalog.ts` (NOVO)
- `lib/connectors/env.ts` (NOVO)
- `lib/connectors/providers.ts` (AJUSTADO)
- `lib/connectors/connections.ts` (AJUSTADO - apenas docs)
- `lib/connectors/sync.ts` (AJUSTADO - adicionado listAuditLogs)

### Pages
- `app/app/connections/page.tsx` (REFATORADO)

### Components
- `components/connections-wizard-client.tsx` (NOVO - substitui connections-list-client)
- `components/connections-list-client.tsx` (DEPRECATED - manter para compatibilidade se necessário)

## Status

✅ **MC3.1b COMPLETO**

Wizard funcional. Provider Catalog implementado. Validação de env sem vazar segredos. Auditoria visível. Pronto para MC8 plug-in do SDK.

