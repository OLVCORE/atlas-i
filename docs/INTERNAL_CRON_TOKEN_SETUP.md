# Configuração do INTERNAL_CRON_TOKEN

## O que é?

O `INTERNAL_CRON_TOKEN` é um token secreto usado para autenticar requisições ao endpoint de automação `/api/alerts/evaluate`. Ele protege o endpoint contra acesso não autorizado.

## Onde é usado?

- **Arquivo:** `app/api/alerts/evaluate/route.ts`
- **Endpoint:** `POST /api/alerts/evaluate`
- **Propósito:** Autenticar requisições de cron jobs ou webhooks externos que avaliam alertas automaticamente

## Como gerar um token seguro?

### Opção 1: OpenSSL (Recomendado)

```bash
# Windows (PowerShell)
openssl rand -hex 32

# Linux/Mac
openssl rand -hex 32
```

**Exemplo de saída:**
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### Opção 2: Node.js

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Opção 3: Online (use apenas para desenvolvimento)

Você pode usar geradores online, mas **NÃO use em produção**. Para produção, sempre use OpenSSL ou Node.js.

## Vercel Cron usa CRON_SECRET

O Vercel Cron Jobs usa `CRON_SECRET` como padrão para autenticação. O endpoint `/api/cron/alerts` aceita `CRON_SECRET` primeiro, com fallback para `INTERNAL_CRON_TOKEN` (para chamadas manuais via curl).

**Recomendação:** Configure `CRON_SECRET` no Vercel com o mesmo valor do token gerado. O `INTERNAL_CRON_TOKEN` ainda funciona para testes manuais, mas `CRON_SECRET` é o padrão para automação.

---

## Como configurar?

### 1. Desenvolvimento Local (.env.local)

1. Abra o arquivo `.env.local` na raiz do projeto
2. Adicione a linha:

```env
INTERNAL_CRON_TOKEN=seu-token-gerado-aqui
```

**Exemplo completo do `.env.local`:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CRON_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
INTERNAL_CRON_TOKEN=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Nota:** Para desenvolvimento local, você pode usar o mesmo valor para ambos, ou apenas `CRON_SECRET` (o endpoint faz fallback para `INTERNAL_CRON_TOKEN`).

3. **IMPORTANTE:** O arquivo `.env.local` já está no `.gitignore`, então não será commitado.

### 2. Vercel (Produção)

#### Via Dashboard Vercel:

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** > **Environment Variables**
4. Adicione **CRON_SECRET** (padrão para Vercel Cron):
   - **Key:** `CRON_SECRET`
   - **Value:** Seu token gerado (ex: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`)
   - **Environments:** Selecione:
     - ✅ Production
     - ✅ Preview
     - ✅ Development (opcional)
   - Clique em **Save**
5. (Opcional) Adicione também **INTERNAL_CRON_TOKEN** para testes manuais:
   - **Key:** `INTERNAL_CRON_TOKEN`
   - **Value:** Mesmo valor do `CRON_SECRET` (ou diferente, se preferir)
   - **Environments:** Mesmos ambientes
   - Clique em **Save**
6. **Importante:** Faça um novo deploy após adicionar as variáveis

#### Via CLI Vercel:

```bash
# Instalar Vercel CLI (se ainda não tiver)
npm i -g vercel

# Fazer login
vercel login

# Adicionar variável de ambiente
vercel env add INTERNAL_CRON_TOKEN production
# Cole o token quando solicitado
```

### 3. Outros ambientes (Docker, servidor próprio, etc.)

Configure a variável de ambiente conforme a plataforma:

**Docker:**
```dockerfile
ENV INTERNAL_CRON_TOKEN=seu-token-aqui
```

**Docker Compose:**
```yaml
environment:
  - INTERNAL_CRON_TOKEN=seu-token-aqui
```

**Systemd (Linux):**
```ini
[Service]
Environment="INTERNAL_CRON_TOKEN=seu-token-aqui"
```

## Como testar?

### 1. Teste sem token (deve retornar 401)

```bash
curl -X POST http://localhost:3000/api/alerts/evaluate \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Resposta esperada:**
```json
{
  "error": "Não autorizado. Token de autenticação obrigatório."
}
```

### 2. Teste com token inválido (deve retornar 401)

```bash
curl -X POST http://localhost:3000/api/alerts/evaluate \
  -H "Authorization: Bearer token-invalido" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Resposta esperada:**
```json
{
  "error": "Não autorizado. Token de autenticação obrigatório."
}
```

### 3. Teste com token válido (deve retornar 200)

```bash
curl -X POST http://localhost:3000/api/alerts/evaluate \
  -H "Authorization: Bearer seu-token-aqui" \
  -H "Content-Type: application/json" \
  -d '{"workspace_ids": []}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "processed": 1,
  "total_workspaces": 1,
  "total_alerts": 0,
  "errors": undefined
}
```

## Configurar Cron Job

### Vercel Cron Jobs

1. Crie o arquivo `vercel.json` na raiz do projeto:

```json
{
  "crons": [
    {
      "path": "/api/alerts/evaluate",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

2. Configure o header de autenticação no Vercel:

No Vercel Dashboard, vá em **Settings** > **Cron Jobs** e configure o header:

```
Authorization: Bearer ${INTERNAL_CRON_TOKEN}
```

**Nota:** O Vercel Cron Jobs pode não suportar headers customizados diretamente. Nesse caso, você pode:

- Usar um webhook externo (GitHub Actions, cron-job.org, etc.)
- Passar o token como query parameter (menos seguro, mas funcional)

### GitHub Actions (Alternativa)

Crie `.github/workflows/evaluate-alerts.yml`:

```yaml
name: Evaluate Alerts

on:
  schedule:
    - cron: '0 */6 * * *'  # A cada 6 horas
  workflow_dispatch:  # Permite execução manual

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - name: Call API
        run: |
          curl -X POST https://seu-dominio.com/api/alerts/evaluate \
            -H "Authorization: Bearer ${{ secrets.INTERNAL_CRON_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

Configure o secret no GitHub:
1. Vá em **Settings** > **Secrets and variables** > **Actions**
2. Clique em **New repository secret**
3. Nome: `INTERNAL_CRON_TOKEN`
4. Value: Seu token gerado

### Cron-job.org (Alternativa simples)

1. Acesse: https://cron-job.org
2. Crie uma conta e um novo cron job
3. Configure:
   - **URL:** `https://seu-dominio.com/api/alerts/evaluate`
   - **Method:** POST
   - **Headers:**
     ```
     Authorization: Bearer seu-token-aqui
     Content-Type: application/json
     ```
   - **Body:** `{}`
   - **Schedule:** A cada 6 horas (ou conforme necessário)

## Segurança

### ✅ Boas Práticas

- Use tokens longos e aleatórios (mínimo 32 caracteres hex)
- **NUNCA** commite o token no repositório
- Use tokens diferentes para cada ambiente (dev, staging, prod)
- Rotacione o token periodicamente (ex: a cada 3-6 meses)
- Monitore logs de acesso ao endpoint

### ❌ O que NÃO fazer

- Não use tokens simples como "123" ou "teste"
- Não commite tokens em arquivos versionados
- Não compartilhe tokens em mensagens não criptografadas
- Não use o mesmo token em múltiplos projetos
- Não exponha o token em logs ou mensagens de erro

## Troubleshooting

### Erro: "INTERNAL_CRON_TOKEN não configurado"

**Causa:** A variável de ambiente não está definida.

**Solução:**
1. Verifique se o `.env.local` existe e contém `INTERNAL_CRON_TOKEN`
2. Reinicie o servidor de desenvolvimento (`npm run dev`)
3. No Vercel, verifique se a variável está configurada em **Settings** > **Environment Variables**

### Erro: 401 "Não autorizado"

**Causa:** Token inválido ou ausente no header.

**Solução:**
1. Verifique se o header `Authorization: Bearer <token>` está presente
2. Confirme que o token no header corresponde ao `INTERNAL_CRON_TOKEN` configurado
3. Verifique se há espaços extras ou caracteres especiais no token

### Erro: Token funciona localmente mas não no Vercel

**Causa:** Variável de ambiente não configurada no Vercel ou ambiente incorreto.

**Solução:**
1. Verifique em **Settings** > **Environment Variables** se a variável está configurada
2. Confirme que está selecionado o ambiente correto (Production/Preview)
3. Faça um novo deploy após adicionar a variável

## Referências

- [SECURITY.md](../SECURITY.md) - Documentação completa de segurança
- [app/api/alerts/evaluate/route.ts](../app/api/alerts/evaluate/route.ts) - Implementação do endpoint

