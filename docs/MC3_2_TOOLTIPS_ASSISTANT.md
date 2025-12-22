# MC3.2 - Tooltips System + Assistant Virtual (ATLAS Guide)

## Objetivo

Adicionar dois pilares de produto ao ATLAS-i:
- **Sistema de Tooltips/Help**: Copys corporativas + explicações por campo e etapa
- **Assistente Virtual (IA)**: Guia o usuário dentro da plataforma, com governança e evidências

---

## A) TOOLTIP SYSTEM

### Componente

**Arquivo:** `components/help/HelpTooltip.tsx`

Componente padrão baseado em shadcn/ui Tooltip + ícone Info (lucide).
- Props: `contentKey`, `customContent`, `side`, `align`, `className`
- Visual: discreto, corporativo, sem cores gritantes
- Acessibilidade: suporte a focus/keyboard, aria-label

### Registry

**Arquivo:** `lib/help/registry.ts`

Registry central com todos os textos de ajuda organizados por chave semântica.

**Chaves disponíveis:**

- Login: `login.email`, `login.password`, `login.magic_link`, `login.confirmation`
- Entities: `entities.type`, `entities.legal_name`, `entities.document`, `entities.cnpj_search`
- Accounts: `accounts.type`, `accounts.opening_balance`, `accounts.opening_balance_date`
- Ledger: `ledger.entity`, `ledger.account`, `ledger.type`, `ledger.date`, `ledger.amount`, `ledger.description`
- Cards: `cards.template`, `cards.brand`, `cards.closing_day`, `cards.due_day`, `cards.active`
- Connections: `connections.catalog`, `connections.config`, `connections.connection`, `connections.sync`, `connections.map_accounts`, `connections.env`
- Purchases: `purchases.card`, `purchases.purchase_date`, `purchases.total_amount`, `purchases.installments`, `purchases.competence`
- Installments: `installments.filters`, `installments.post`, `installments.due_date`

### Aplicação

Tooltips aplicados nas seguintes telas:
- `/app/login`: Email, Senha, Magic Link, Mensagens de confirmação
- `/app/entities`: Tipo, Nome/Razão, CPF/CNPJ, Buscar dados
- `/app/accounts`: Tipo, Saldo inicial, Data do saldo
- `/app/ledger`: Entidade, Conta opcional, Tipo, Data, Valor, Descrição
- `/app/cards`: Template, Bandeira, closing_day, due_day, Ativo
- `/app/connections`: Provider catálogo, Provider config, Connection
- `/app/purchases`: Cartão, Data compra, Total, Parcelas, Competência

### Microcopy

Cada tooltip segue padrão corporativo:
- Explica o "por quê"
- Explica a regra
- Fornece exemplo curto real (sem placeholders)
- Texto objetivo, sem tom informal

---

## B) ASSISTENTE VIRTUAL - "ATLAS Guide"

### Escopo

O assistente:
- ✅ Explica telas, campos, regras (cartão, competência, recebíveis)
- ✅ Ajuda a configurar Open Finance (quando chegar no MC8)
- ✅ Sugere próximos passos do setup ("Você ainda não criou nenhuma entidade PJ")
- ✅ Responde dúvidas sobre "como lançar", "como conciliar", "como interpretar alertas"
- ❌ NÃO cria transações
- ❌ NÃO altera dados
- ❌ NÃO escreve no banco
- ✅ Sempre cita dados existentes do usuário (quando houver)

### Endpoint

**Arquivo:** `app/api/assistant/route.ts`

**Recebe:**
```json
{
  "message": "string",
  "contextHint": "string (opcional)"
}
```

**Puxa contexto do workspace:**
- Workspace atual (nome, ID)
- Contagens: entities, accounts, cards, transactions, connections, providers
- Últimos 10 lançamentos (descrição, data, valor) - se existir
- Status de connectors (providers/connections/sync_runs)

**Monta prompt com:**
- Regras absolutas (não inventar, não escrever, só orientar)
- Responder em PT-BR corporativo, curto, objetivo
- Contexto do workspace do usuário

**Chama OpenAI:**
- ENV: `OPENAI_API_KEY` (obrigatório)
- ENV: `OPENAI_MODEL` (opcional, default: `gpt-4o-mini`)
- Endpoint: `https://api.openai.com/v1/chat/completions`

**Retorna:**
```json
{
  "answer": "string",
  "citations": ["string"] // Opcional, baseado no contexto usado
}
```

### UI

**Componente:** `components/assistant/AssistantDrawer.tsx`

- Botão no header (ícone MessageCircle discreto)
- Abre Sheet lateral (drawer)
- Histórico de mensagens (session only, não salva ainda)
- Sugestões rápidas (chips):
  - "Como criar uma PJ?"
  - "Como funciona o dia de corte?"
  - "Como conciliar parcelas?"
  - "O que falta para conectar banco?"
- Estados vazios reais: sem mensagens, mostrar apenas chips e input

### Segurança e Limites

**Rate Limiting:**
- 30 requisições por hora por usuário (em memória do servidor)
- Reset automático a cada hora
- Retorna 429 se excedido

**Sanitização:**
- Mensagem limitada a 1000 caracteres
- Validação de tipo e presença

**Auditoria (opcional, futuro):**
- Tabela `assistant_audit_log` pode ser criada para:
  - `workspace_id`, `user_id`, `created_at`
  - `prompt_tokens`, `completion_tokens`
  - `action="answer"`
- RLS por workspace

---

## Variáveis de Ambiente

Adicionar ao `.env.local` (não commitar):

```env
# Assistant (MC3.2)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # Opcional, padrão: gpt-4o-mini
```

**IMPORTANTE:** `OPENAI_API_KEY` é obrigatória para o assistente funcionar. Sem ela, o endpoint retorna erro 503 (Assistente indisponível: ambiente não configurado).

---

## Como Validar

### Tooltips

1. Acessar qualquer tela mencionada acima
2. Verificar ícone de informação (ⓘ) ao lado dos labels principais
3. Clicar/hover no ícone - tooltip deve aparecer com explicação
4. Verificar acessibilidade (teclado/focus)

### Assistente

1. Configurar `OPENAI_API_KEY` no `.env.local`
2. Iniciar servidor: `npm run dev`
3. Acessar qualquer página do app
4. Clicar no ícone de mensagem no header
5. Verificar drawer lateral abre
6. Testar sugestões rápidas
7. Testar pergunta livre
8. Verificar resposta contextualizada

### Testes de Exemplo

**Perguntas que devem funcionar:**
- "Como criar uma entidade PJ?"
- "O que é dia de corte?"
- "Quantas contas eu tenho?" (baseado no contexto)
- "Como funciona o ciclo do cartão?"

**Respostas esperadas:**
- Corporativas, objetivas, em PT-BR
- Sempre mencionam se baseiam em dados do workspace
- Nunca tentam criar/editar dados

---

## Arquivos Criados/Alterados

### Components
- `components/ui/tooltip.tsx` (NOVO)
- `components/ui/sheet.tsx` (NOVO)
- `components/help/HelpTooltip.tsx` (NOVO)
- `components/assistant/AssistantDrawer.tsx` (NOVO)

### Libraries
- `lib/help/registry.ts` (NOVO)
- `lib/assistant/context.ts` (NOVO)

### APIs
- `app/api/assistant/route.ts` (NOVO)

### Pages (ajustadas para incluir tooltips)
- `app/login/page.tsx`
- `components/entity-form.tsx`
- `app/app/accounts/page.tsx`
- `app/app/ledger/page.tsx`
- `components/card-form-client.tsx`
- `components/purchase-form.tsx`
- `components/connections-wizard-client.tsx`

### Layout
- `app/app/layout.tsx` (adicionado AssistantDrawer)

### Package
- `package.json` (adicionado `@radix-ui/react-tooltip`, `@radix-ui/react-dialog`)

### Documentation
- `docs/MC3_2_TOOLTIPS_ASSISTANT.md` (este arquivo)

---

## Próximos Passos (Opcional)

1. **Auditoria do Assistente:**
   - Criar tabela `assistant_audit_log` no Supabase
   - Registrar todas as interações (prompt, resposta, tokens)
   - Dashboard de uso do assistente

2. **Melhorias no Tooltip:**
   - Links para documentação externa
   - Vídeos tutoriais embutidos
   - Tooltips contextuais (mostrar apenas quando relevante)

3. **Melhorias no Assistente:**
   - Histórico persistente por usuário
   - Sugestões dinâmicas baseadas no estado atual
   - Integração com webhooks para notificações proativas

---

## Status

✅ **MC3.2 COMPLETO**

Tooltips aplicados nas principais telas. Assistente funcional com integração OpenAI. Rate limiting e sanitização implementados.

