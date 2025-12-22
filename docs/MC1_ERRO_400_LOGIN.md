# MC1 - Erro 400 no Login - Solução

## Problema

Erro 400 (Bad Request) ao tentar fazer login:
```
POST https://vydsayvhovuqfdelxtko.supabase.co/auth/v1/token?grant_type=password 400 (Bad Request)
```

## Causas Comuns

### 1. Usuário Não Existe
O e-mail informado não foi cadastrado ainda.

**Solução:** 
- Use o botão "Criar conta" primeiro para criar o usuário
- Ou verifique se digitou o e-mail corretamente

### 2. Senha Incorreta
A senha não corresponde ao e-mail cadastrado.

**Solução:**
- Verifique se a senha está correta
- Use o botão de olho para visualizar a senha enquanto digita
- Se esqueceu a senha, será necessário redefini-la (funcionalidade futura)

### 3. E-mail Não Confirmado
Se a opção "Confirm email" estiver habilitada no Supabase, você precisa confirmar o e-mail primeiro.

**Solução:**
- Verifique sua caixa de entrada (e spam) para o e-mail de confirmação
- Ou desabilite "Confirm email" no Supabase Dashboard > Authentication > Providers > Email

## Melhorias Aplicadas

✅ Validação antes de enviar (e-mail e senha obrigatórios, senha mínimo 6 caracteres)
✅ Mensagens de erro mais claras e em português
✅ Tratamento específico para erro 400
✅ Tratamento de espaços em branco no e-mail (trim)

## Teste Recomendado

1. **Criar uma conta primeiro:**
   - E-mail: `teste@atlas-i.local`
   - Senha: `senha123456`
   - Clique em "Criar conta"

2. **Fazer login:**
   - Use as mesmas credenciais
   - Clique em "Entrar"

Se o erro 400 persistir após criar a conta, verifique:
- Se o e-mail foi digitado corretamente
- Se a senha corresponde à cadastrada
- Se há confirmação de e-mail habilitada no Supabase

## Nota sobre Favicon 404

O erro `favicon.ico 404` é apenas um aviso estético. Não afeta a funcionalidade do sistema. Pode ser resolvido posteriormente adicionando um favicon na pasta `public/`.

