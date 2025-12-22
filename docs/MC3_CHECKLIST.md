# MC3 - Checklist de Validação

## Banco de Dados

- [ ] Migration `20251221_000004_mc3_cards_installments.sql` criada e aplicada
- [ ] Tabela `cards` criada com campos corretos
- [ ] Tabela `card_purchases` criada com campos corretos
- [ ] Tabela `card_installments` criada com campos corretos
- [ ] Tabela `card_audit_log` criada
- [ ] RLS habilitado em todas as tabelas
- [ ] Policies criadas corretamente (sem recursão)
- [ ] Índices criados para performance
- [ ] Constraints de validação funcionando (closing_day/due_day 1-28, total_amount > 0, etc.)

## Motor de Cálculo

- [ ] `resolveStatementMonth()` funciona corretamente
  - [ ] Compra dia 14 com closing_day=14 => competência mês atual
  - [ ] Compra dia 15 com closing_day=14 => competência mês seguinte
- [ ] `addMonths()` adiciona meses corretamente
- [ ] `generateInstallments()` distribui valores corretamente
  - [ ] Parcelas somam exatamente ao total (sem erro de centavos)
  - [ ] Centavos distribuídos nas primeiras parcelas

## Funcionalidades

### Cartões

- [ ] Criar cartão funciona
- [ ] Listar cartões funciona
- [ ] Filtrar cartões por entidade funciona
- [ ] Campos obrigatórios validados
- [ ] closing_day e due_day validados (1-28)

### Compras

- [ ] Criar compra funciona
- [ ] Geração de parcelas funciona automaticamente
- [ ] Competência inicial calculada corretamente
- [ ] Parcelas criadas com valores corretos
- [ ] first_installment_month opcional funciona

### Parcelas

- [ ] Listar parcelas por período funciona
- [ ] Filtrar por entity/card/status funciona
- [ ] Totais por mês calculados corretamente
- [ ] Postar parcela no ledger funciona
  - [ ] Cria transaction corretamente
  - [ ] Vincula posted_transaction_id
  - [ ] Marca status como 'posted'
  - [ ] Data calculada usando due_day
- [ ] Parcela já postada não pode ser postada novamente

## Interface

- [ ] Página `/app/cards` renderiza corretamente
- [ ] Formulário de criação de cartão funciona
- [ ] Tabela de cartões exibe dados corretamente
- [ ] Página `/app/purchases` renderiza corretamente
- [ ] Formulário de compra funciona
- [ ] Carregamento de cartões por entidade funciona
- [ ] Página `/app/installments` renderiza corretamente
- [ ] Filtros de parcelas funcionam
- [ ] Modal de postar parcela funciona
- [ ] Estados vazios exibidos corretamente

## Integração

- [ ] Integração com Ledger funciona
- [ ] Transaction criada como expense (valor negativo)
- [ ] Data de vencimento calculada corretamente
- [ ] Descrição preenchida corretamente

## Multi-tenancy e Segurança

- [ ] RLS isolando workspaces funciona
- [ ] Usuário A não vê dados do workspace do usuário B
- [ ] Policies impedem trocar workspace_id
- [ ] Auditoria registrada corretamente

## Testes Manuais

### Teste 1: Ciclo de Closing Day
1. Criar cartão com closing_day=14
2. Registrar compra no dia 14
3. Verificar que competência é do mês atual
4. Registrar compra no dia 15
5. Verificar que competência é do mês seguinte

### Teste 2: Distribuição de Parcelas
1. Registrar compra de R$ 100,00 em 3 parcelas
2. Verificar que parcelas somam exatamente R$ 100,00
3. Verificar distribuição de centavos (se houver)

### Teste 3: Postar Parcela
1. Criar compra parcelada
2. Ir para agenda de parcelas
3. Postar primeira parcela no ledger
4. Verificar transaction criada
5. Verificar status da parcela atualizado
6. Tentar postar novamente (deve falhar)

### Teste 4: RLS
1. Criar workspace A e workspace B
2. Criar cartão no workspace A
3. Logar como usuário do workspace B
4. Verificar que cartão do workspace A não aparece

## Documentação

- [ ] MC3_DESIGN.md criado
- [ ] MC3_CHECKLIST.md criado (este arquivo)
- [ ] MC3_RESUMO.md criado

## Conclusão

- [ ] Todos os itens acima validados
- [ ] `npm run dev` compila sem erros
- [ ] Rotas novas aparecem no header
- [ ] Sistema funcional e pronto para uso

