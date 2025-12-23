# Resumo da Integração Pluggy - ATLAS-i

## Status: Implementação Completa

### Arquivos Criados/Modificados

#### Endpoints API
- ✅ `app/api/integrations/pluggy/health/route.ts` - Health check de credenciais
- ✅ `app/api/pluggy/auth/route.ts` - Diagnóstico interno (já existia)
- ✅ `app/api/pluggy/connect-token/route.ts` - Gerar connect token (já existia)
- ✅ `app/api/pluggy/webhook/route.ts` - Receber webhooks (já existia)
- ✅ `app/api/pluggy/items/[itemId]/accounts/route.ts` - Buscar contas
- ✅ `app/api/pluggy/items/[itemId]/transactions/route.ts` - Buscar transações
- ✅ `app/api/pluggy/items/[itemId]/investments/route.ts` - Buscar investimentos

#### Helpers
- ✅ `lib/pluggy/auth.ts` - Autenticação e cache de API Key (já existia)
- ✅ `lib/pluggy/http.ts` - Helper para chamadas HTTP (já existia, ajustado)

#### UI/Components
- ✅ `components/connections-wizard-client.tsx` - Atualizado para usar `hasPluggyCredentials`
- ✅ `lib/connectors/env.ts` - Adicionado `hasPluggyCredentials` ao EnvStatus

## Endpoints Disponíveis

### 1. Health Check
```
GET /api/integrations/pluggy/health
```
Retorna: `{ ok: true }` se credenciais válidas, `{ ok: false, reason: "..." }` se inválidas

### 2. Connect Token
```
POST /api/pluggy/connect-token
Body: { clientUserId?, webhookUrl?, oauthRedirectUri?, avoidDuplicates? }
Retorna: { ok: true, connectToken, issued_at, duration_ms }
```

### 3. Buscar Contas
```
GET /api/pluggy/items/:itemId/accounts
Retorna: { ok: true, accounts: [...], page, total, totalPages }
```

### 4. Buscar Transações
```
GET /api/pluggy/items/:itemId/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&accountId=xxx
Retorna: { ok: true, transactions: [...], page, total, totalPages }
```

### 5. Buscar Investimentos
```
GET /api/pluggy/items/:itemId/investments
Retorna: { ok: true, investments: [...], page, total, totalPages }
```

## Variáveis de Ambiente (Vercel)

**Server-only (não NEXT_PUBLIC_*):**
- `PLUGGY_CLIENT_ID` - Client ID da Pluggy
- `PLUGGY_CLIENT_SECRET` - Client Secret da Pluggy
- `PLUGGY_WEBHOOK_SECRET` - Token para validar webhooks (opcional)

## Fluxo de Integração

1. **Credenciais Detectadas:**
   - UI verifica `envCheck?.hasPluggyCredentials` (vem de `lib/connectors/env.ts`)
   - `hasPluggyCredentials = !!(PLUGGY_CLIENT_ID && PLUGGY_CLIENT_SECRET)`
   - Exibe "Sim" se verdadeiro, "Não" se falso

2. **Ativar Provider:**
   - Usuário clica "Ativar" no provider Pluggy
   - Chama `updateProviderStatusAction(providerId, 'active')`
   - Atualiza `status` na tabela `providers` para 'active'

3. **Criar Conexão:**
   - Frontend chama `POST /api/pluggy/connect-token` com:
     - `clientUserId`: UUID do usuário no ATLAS-i
     - `webhookUrl`: `https://seu-dominio.com/api/pluggy/webhook`
   - Backend retorna `connectToken`
   - Frontend inicializa Pluggy Widget com `connectToken`
   - Após conexão, Pluggy retorna `itemId`
   - Frontend salva `itemId` em `connections.external_connection_id`

4. **Buscar Dados:**
   - Frontend chama endpoints:
     - `GET /api/pluggy/items/:itemId/accounts`
     - `GET /api/pluggy/items/:itemId/transactions`
     - `GET /api/pluggy/items/:itemId/investments`
   - Backend usa `pluggyFetch()` que obtém `apiKey` automaticamente
   - Retorna dados para frontend processar/persistir

## Estrutura do Banco

### Tabela `providers`
- `id` (uuid)
- `workspace_id` (uuid)
- `catalog_id` (uuid, referencia `provider_catalog`)
- `kind` ('aggregator' | 'open_finance_direct')
- `name` (text)
- `status` ('active' | 'inactive') ← **aqui controla ativo/inativo**
- `config` (jsonb)
- `created_at`, `updated_at`

### Tabela `connections`
- `id` (uuid)
- `workspace_id` (uuid)
- `entity_id` (uuid)
- `provider_id` (uuid)
- `status` ('needs_setup' | 'connecting' | 'active' | 'error' | 'revoked')
- `external_connection_id` (text) ← **aqui vai o itemId da Pluggy**
- `last_sync_at` (timestamptz)
- `last_error` (text)
- `metadata` (jsonb)
- `created_at`, `updated_at`

## Testes

### Comandos Executados
```bash
npm run lint      # ✅ Passou
npm run typecheck # ✅ Passou
npm run build     # ✅ Passou
```

### Exemplos de Chamadas curl

**Health Check:**
```bash
curl http://localhost:3000/api/integrations/pluggy/health
```

**Connect Token:**
```bash
curl -X POST http://localhost:3000/api/pluggy/connect-token \
  -H "Content-Type: application/json" \
  -d '{"clientUserId": "uuid-do-usuario"}'
```

**Buscar Contas:**
```bash
curl http://localhost:3000/api/pluggy/items/ITEM_ID/accounts
```

**Buscar Transações:**
```bash
curl "http://localhost:3000/api/pluggy/items/ITEM_ID/transactions?from=2024-01-01&to=2024-12-31"
```

## Próximos Passos (Não Implementados)

1. **Widget Pluggy no Frontend:**
   - Integrar Pluggy Connect Widget
   - Capturar `itemId` após conexão
   - Persistir `itemId` em `connections.external_connection_id`

2. **Ingestão Automática:**
   - Criar sync job que busca dados periodicamente
   - Persistir em `external_accounts`, `external_transactions`
   - Implementar mapeamento para `accounts` e `transactions` internos

3. **Persistência de Webhook:**
   - Criar tabela `pluggy_webhook_events` (se necessário)
   - Processar eventos de webhook para atualizar status de conexões

