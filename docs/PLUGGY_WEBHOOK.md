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

O endpoint aceita autenticação via um dos seguintes headers:

### Opção 1: Header `x-pluggy-signature`
```
x-pluggy-signature: <PLUGGY_WEBHOOK_SECRET>
```

### Opção 2: Header `Authorization: Bearer`
```
Authorization: Bearer <PLUGGY_WEBHOOK_SECRET>
```

**Nota:** O endpoint aceita qualquer um dos dois formatos para flexibilidade.

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
   - **Value:** O token gerado (ex: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`)
   - **Environments:** Selecione:
     - ✅ Production
     - ✅ Preview (opcional)
     - ✅ Development (opcional)
6. Clique em **Save**
7. **Importante:** Faça um novo deploy após adicionar a variável

### 3. Configurar na Pluggy

Ao criar ou editar um webhook na Pluggy:

1. **URL:** Cole a URL completa do webhook (ex: `https://atlas-i.vercel.app/api/pluggy/webhook`)
2. **Headers:** Adicione um dos seguintes:
   - `x-pluggy-signature: <valor-do-PLUGGY_WEBHOOK_SECRET>`
   - OU `Authorization: Bearer <valor-do-PLUGGY_WEBHOOK_SECRET>`

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

