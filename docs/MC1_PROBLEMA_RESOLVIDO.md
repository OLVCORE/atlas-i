# MC1 - Problema Resolvido: Variáveis de Ambiente

## Problema Identificado

Erro ao executar `npm run dev`:
```
Error: Your project's URL and Key are required to create a Supabase client!
```

**Causa:** Arquivo `.env.local` não existia.

## Solução Aplicada

✅ Arquivo `.env.local` criado na raiz do projeto com as credenciais do Supabase.

## Próximo Passo

**REINICIAR o servidor Next.js:**

1. Parar o servidor atual (Ctrl+C no terminal)
2. Executar novamente:
   ```bash
   npm run dev
   ```

O Next.js precisa ser reiniciado para carregar as variáveis de ambiente do `.env.local`.

## Validação

Após reiniciar, o servidor deve iniciar sem erros e você deve poder:
- Acessar `http://localhost:3000`
- Ver a página de login
- Não ver mais o erro de "URL and Key are required"

