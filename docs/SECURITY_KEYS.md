# Segurança de Chaves e Credenciais

## Regra Fundamental

**Chaves e credenciais NUNCA devem estar no código, documentação ou commits.**

Chaves devem existir APENAS em:
- `.env.local` (desenvolvimento local)
- Vault/Secret Manager (produção)
- Variáveis de ambiente do servidor (deployment)

## Variáveis Sensíveis no ATLAS-i

### OPENAI_API_KEY
- **Onde:** Apenas em `.env.local` (dev) e vault (prod)
- **Nunca:** No código, docs, commits, logs, prints, chats
- **Rotação:** Se exposta, revogar imediatamente no dashboard OpenAI e gerar nova

### Supabase Keys
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Pode estar em `.env.local` (é pública, mas ainda assim não commitar)
- Service Role Key: Apenas no servidor/vault, NUNCA no código

### Connectors Keys (MC8)
- `CONNECTORS_CLIENT_ID`, `CONNECTORS_CLIENT_SECRET`: Apenas em `.env.local`/vault
- Webhook secrets: Apenas em `.env.local`/vault

## Checklist Antes de Commit

Antes de fazer commit, verifique:

- [ ] Nenhum arquivo `.env.local` ou `.env` está sendo commitado
- [ ] Nenhuma chave real aparece em:
  - [ ] Código fonte (`.ts`, `.tsx`, `.js`)
  - [ ] Documentação (`.md`)
  - [ ] Arquivos de configuração (`.json`, `.yaml`)
  - [ ] Comentários no código
- [ ] `.gitignore` inclui `.env.local` e `.env*`
- [ ] `.env.example` existe e contém apenas placeholders (`sk-...`, `your-key`, etc.)

## Procedimento de Rotação de Chaves

Se uma chave for exposta:

1. **Revogar imediatamente** no serviço fornecedor (OpenAI, Supabase, etc.)
2. **Gerar nova chave** no dashboard do serviço
3. **Atualizar** apenas em `.env.local` (dev) ou vault (prod)
4. **Reiniciar** serviços que usam a chave
5. **Verificar logs** para garantir que a chave antiga não está mais sendo usada

## Verificação Rápida

Para verificar se há chaves no repositório:

```bash
# Buscar padrões suspeitos (não executar em produção com chaves reais)
grep -r "sk-proj-" --exclude-dir=node_modules --exclude-dir=.next .
grep -r "OPENAI_API_KEY=sk-" --exclude-dir=node_modules --exclude-dir=.next .
```

## Boas Práticas

1. **Nunca colar chaves em:**
   - Chat/email/documentos
   - Screenshots ou prints
   - Issues ou PRs
   - Logs públicos

2. **Ao compartilhar:**
   - Use placeholders: `OPENAI_API_KEY=sk-...`
   - Documente apenas o nome da variável, não o valor

3. **Em produção:**
   - Use secret managers (Vercel Secrets, AWS Secrets Manager, etc.)
   - Nunca hardcode no código
   - Configure variáveis de ambiente no painel de deployment

4. **Para novos desenvolvedores:**
   - Copiar `.env.example` para `.env.local`
   - Preencher com chaves próprias
   - Nunca commitar `.env.local`

## Referências

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [OpenAI API Keys Security](https://platform.openai.com/docs/guides/safety-best-practices)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)

