# Integração Pluggy (Open Finance) - Setup

## O que é X-API-KEY?

O `X-API-KEY` é o **apiKey** retornado pelo endpoint `POST https://api.pluggy.ai/auth` quando você envia `clientId` e `clientSecret`.

**IMPORTANTE:** Você NÃO escolhe manualmente um X-API-KEY fixo. O backend do atlas-i gera isso automaticamente usando `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`, faz cache em memória (50 minutos) e usa esse apiKey em todas as chamadas subsequentes à API Pluggy.

## Fluxo de Autenticação

```
1. Backend recebe request (ex: criar connect token)
2. Backend chama getPluggyApiKey()
   - Verifica cache (válido por 50 min)
   - Se expirado ou ausente, faz POST /auth com CLIENT_ID + CLIENT_SECRET
   - Obtém apiKey da resposta
   - Armazena em cache
3. Backend usa apiKey como header X-API-KEY nas chamadas:
   - POST /connect_token
   - Qualquer outra chamada à API Pluggy
```

## Variáveis de Ambiente (Vercel)

Configure no Vercel Dashboard → Settings → Environment Variables:

### Obrigatórias:
- `PLUGGY_CLIENT_ID` - Client ID da sua conta Pluggy
- `PLUGGY_CLIENT_SECRET` - Client Secret da sua conta Pluggy

### Opcional (para webhook):
- `PLUGGY_WEBHOOK_TOKEN` - Token aleatório para validar webhooks (gerar com `openssl rand -hex 32`)

**IMPORTANTE:**
- ❌ NÃO use `NEXT_PUBLIC_` prefix para nenhuma dessas variáveis
- ✅ Essas variáveis são server-only (nunca expostas no client bundle)
- ✅ Configure em Production e Preview (se necessário)

## Endpoints Disponíveis

### POST /api/pluggy/auth
- **Proteção:** Authorization: Bearer ${INTERNAL_CRON_TOKEN} ou ${CRON_SECRET}
- **Retorno:** `{ ok: true, hasApiKey: true }`
- **Uso:** Diagnóstico interno para verificar se as credenciais estão configuradas

### POST /api/pluggy/connect-token
- **Proteção:** Nenhuma (pode adicionar autenticação se necessário)
- **Body (opcional):**
  ```json
  {
    "clientUserId": "uuid-or-string",
    "webhookUrl": "https://seu-dominio.com/api/pluggy/webhook",
    "oauthRedirectUri": "https://seu-dominio.com/oauth/callback",
    "avoidDuplicates": true
  }
  ```
- **Retorno:**
  ```json
  {
    "ok": true,
    "connectToken": "token-gerado",
    "issued_at": "2024-01-01T00:00:00.000Z",
    "duration_ms": 150
  }
  ```
- **Uso:** Gerar token para o widget Pluggy no frontend

### POST /api/pluggy/webhook
- **Proteção:** Header `x-olv-webhook-token` deve bater com `PLUGGY_WEBHOOK_TOKEN`
- **Uso:** Receber eventos da Pluggy (transações, conexões, etc)
- **URL para configurar na Pluggy:** `https://seu-dominio.com/api/pluggy/webhook`

## Checklist de Segurança

- ✅ `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` são server-only (não `NEXT_PUBLIC_*`)
- ✅ API Key é gerada automaticamente e cached (não hardcoded)
- ✅ Logs não expõem tokens, keys ou segredos
- ✅ Webhook valida token antes de processar
- ✅ Respostas padronizadas com códigos HTTP corretos
- ✅ Fail-closed: retorna erro se credenciais ausentes

## Fluxo Completo (Widget)

1. Frontend chama `POST /api/pluggy/connect-token`
2. Backend obtém apiKey (com cache)
3. Backend chama Pluggy API com X-API-KEY
4. Backend retorna connectToken ao frontend
5. Frontend usa connectToken no widget Pluggy
6. Usuário conecta conta bancária
7. Pluggy envia eventos para `/api/pluggy/webhook`
8. Backend valida token e processa eventos

## Referências

- [Documentação Pluggy](https://docs.pluggy.ai/)
- Endpoint Auth: `POST https://api.pluggy.ai/auth`
- Endpoint Connect Token: `POST https://api.pluggy.ai/connect_token`

