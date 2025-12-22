# DESABILITAR CONFIRMAÇÃO DE EMAIL - INSTRUÇÃO DIRETA

## Passo a Passo (5 minutos)

1. Acesse: https://supabase.com/dashboard/project/vydsayvhovuqfdelxtko/auth/providers

2. Clique em **Email** (na lista de providers)

3. **DESLIGUE** o toggle **"Confirm email"** (deve ficar cinza/desabilitado)

4. Clique em **Save**

5. Pronto. Agora novos usuários podem fazer login imediatamente sem precisar confirmar email.

## Verificar se está desabilitado

Após salvar, o toggle "Confirm email" deve estar **CINZA/DESABILITADO**.

## IMPORTANTE

Esta é uma configuração do Supabase Dashboard. O código já está preparado para funcionar com confirmação desabilitada ou habilitada.

Se você criar um usuário novo AGORA (depois de desabilitar), ele conseguirá fazer login imediatamente com Magic Link ou senha.

