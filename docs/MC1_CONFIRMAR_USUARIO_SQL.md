# MC1 - Confirmar Usuário Manualmente (SQL)

## Problema

Usuário criado mas `email_confirmed_at` está `null`, impedindo login.

## Solução: Confirmar via SQL

Execute no **SQL Editor** do Supabase:

```sql
-- Confirmar o e-mail do usuário
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'marcos.oliveira@olvinternacional.com.br';
```

## Verificar Confirmação

Após executar, verifique:

```sql
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'marcos.oliveira@olvinternacional.com.br';
```

O `email_confirmed_at` deve ter uma data/hora.

## Próximo Passo

Após confirmar, volte ao navegador e tente fazer login novamente.

