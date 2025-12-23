# Webhook Pluggy - Configuração

## URL do Webhook

```
https://<seu-dominio>/api/pluggy/webhook
```

Exemplo:
```
https://atlas-i.vercel.app/api/pluggy/webhook
```

## Headers Aceitos

O endpoint aceita autenticação via um dos seguintes headers (com prioridade):

### Prioridade 1: Header `Authorization: Bearer` (RECOMENDADO)
```
Authorization: Bearer <PLUGGY_WEBHOOK_SECRET>
```

**IMPORTANTE:** O valor de `PLUGGY_WEBHOOK_SECRET` no Vercel deve ser o **segredo PURO** (sem "Bearer ").

### Prioridade 2: Header `x-pluggy-signature`
```
x-pluggy-signature: <PLUGGY_WEBHOOK_SECRET>
```

**Nota:** O endpoint verifica `Authorization: Bearer` primeiro, depois `x-pluggy-signature` como fallback.

## Configuração no Vercel

### 1. Gerar Token Seguro

No terminal (PowerShell):
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ou com OpenSSL:
```bash
openssl rand -hex 32
```

### 2. Configurar no Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** > **Environment Variables**
4. Clique em **Add New**
5. Preencha:
   - **Key:** `PLUGGY_WEBHOOK_SECRET`
   - **Value:** O token gerado (ex: `atlas_i_pluggy_webhook_2025_a1b2c3d4e5f67890...`)
     - ⚠️ **IMPORTANTE:** Use apenas o valor PURO do segredo (sem "Bearer ")
   - **Environments:** Selecione:
     - ✅ Production
     - ✅ Preview (opcional)
     - ✅ Development (opcional)
6. Clique em **Save**
7. **Importante:** Faça um novo deploy após adicionar a variável

### 3. Configurar na Pluggy

Ao criar ou editar um webhook na Pluggy:

1. **URL:** Cole a URL completa do webhook:
   ```
   https://seu-dominio.vercel.app/api/pluggy/webhook
   ```
   Exemplo:
   ```
   https://atlas-i-git-main-olv-core444.vercel.app/api/pluggy/webhook
   ```

2. **Headers:** Adicione (recomendado usar `Authorization: Bearer`):
   - `Authorization: Bearer <valor-do-PLUGGY_WEBHOOK_SECRET>`
   - OU `x-pluggy-signature: <valor-do-PLUGGY_WEBHOOK_SECRET>`
   
   **Nota:** Use o valor PURO do `PLUGGY_WEBHOOK_SECRET` configurado no Vercel. O "Bearer " é adicionado automaticamente pelo header.

## Segurança

- ✅ `PLUGGY_WEBHOOK_SECRET` é server-only (não `NEXT_PUBLIC_*`)
- ✅ Endpoint retorna 500 se segredo não estiver configurado (fail-closed)
- ✅ Endpoint retorna 401 se segredo inválido
- ✅ Logs seguros (não imprime body completo, apenas campos específicos)
- ✅ Sem segredos expostos no client bundle

## Resposta do Endpoint

### Sucesso (200)
```json
{
  "ok": true
}
```

### Erro de Autenticação (401)
```json
{
  "ok": false,
  "error": "unauthorized",
  "message": "Segredo de webhook inválido"
}
```

### Erro de Configuração (500)
```json
{
  "ok": false,
  "error": "misconfig",
  "message": "Configuração ausente. Verifique PLUGGY_WEBHOOK_SECRET."
}
```

## Logs

O endpoint registra logs seguros com:
- `timestamp`: Data/hora do evento
- `type`: Tipo do evento (se disponível)
- `itemId`: ID do item (se disponível)
- `clientUserId`: ID do cliente (se disponível)
- `event`: Nome do evento (se disponível)

**Nota:** O body completo não é logado para evitar vazamento de dados sensíveis.

## Teste Manual

**Com Authorization: Bearer (recomendado):**
```bash
curl -X POST https://seu-dominio.com/api/pluggy/webhook \
  -H "Authorization: Bearer seu-secret-aqui" \
  -H "Content-Type: application/json" \
  -d '{"type": "test", "event": "item.created"}'
```

**Com x-pluggy-signature (alternativo):**
```bash
curl -X POST https://seu-dominio.com/api/pluggy/webhook \
  -H "x-pluggy-signature: seu-secret-aqui" \
  -H "Content-Type: application/json" \
  -d '{"type": "test", "event": "item.created"}'
```

Resposta esperada:
```json
{
  "ok": true
}
```

