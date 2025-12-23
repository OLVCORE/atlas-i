# MC10 - Correção de Vinculação de Conexões Pluggy às Entidades Corretas

## 🚨 PROBLEMA IDENTIFICADO

Todas as 3 conexões Pluggy foram criadas com o mesmo `entity_id` (OLV Internacional - `929d8d06-7e52-4061-9566-19f00c07f483`), quando deveriam estar vinculadas a entidades diferentes:

| Entidade | Documento | entity_id Correto | Conexões Atuais | Status |
|----------|-----------|-------------------|-----------------|--------|
| **PF: Marcos Francisco** | CPF 08583177880 | `8ebcd93b-23ca-434b-953c-1d5347253162` | 0 | ❌ Errado |
| **PJ: OLV Internacional** | CNPJ 67867580000190 | `929d8d06-7e52-4061-9566-19f00c07f483` | 3 | ❌ Errado (deveria ser 1) |
| **PJ: XRP** | CNPJ 34338165000190 | `d4aa94f1-c0b0-4e7c-9d44-23b655c39b6e` | 0 | ❌ Errado |

**Causa Raiz**: Quando o usuário conectou via Pluggy, o sistema não estava vinculando corretamente ao `entity_id` selecionado na UI. Todas as conexões foram criadas com o mesmo `entity_id` (OLV).

---

## ✅ SOLUÇÃO RECOMENDADA

### Opção 1: Correção Manual (RECOMENDADA - Mais Segura)

**Vantagens**:
- ✅ Preserva histórico
- ✅ Não perde dados
- ✅ Permite validação antes de aplicar
- ✅ Reversível

**Passos**:

1. **Identificar qual conexão pertence a qual entidade**:
   - Execute o script `supabase/sql/mc10_fix_connections_entity_mapping.sql` (PASSO 1 e 2)
   - Identifique manualmente qual `pluggy_item_id` pertence a qual entidade baseado em:
     - Ordem de criação (`created_at`)
     - Teste manual: desconectar e reconectar cada entidade
     - Metadados da conexão (se houver)

2. **Reatribuir conexões aos entity_id corretos**:
   - Execute os UPDATEs do PASSO 3 do script, substituindo pelos valores reais
   - Exemplo:
     ```sql
     -- Conexão da PF (Marcos Francisco)
     UPDATE connections
     SET entity_id = '8ebcd93b-23ca-434b-953c-1d5347253162', updated_at = NOW()
     WHERE id = '<connection_id_da_pf>'
       AND external_connection_id = '<pluggy_item_id_da_pf>';
     
     -- Conexão da OLV (manter apenas 1, marcar outras 2 como revoked)
     UPDATE connections
     SET status = 'revoked', last_error = 'Duplicata corrigida manualmente', updated_at = NOW()
     WHERE id IN ('<connection_id_2>', '<connection_id_3>')
       AND entity_id = '929d8d06-7e52-4061-9566-19f00c07f483';
     
     -- Conexão da XRP
     UPDATE connections
     SET entity_id = 'd4aa94f1-c0b0-4e7c-9d44-23b655c39b6e', updated_at = NOW()
     WHERE id = '<connection_id_da_xrp>'
       AND external_connection_id = '<pluggy_item_id_da_xrp>';
     ```

3. **Limpar dados incorretos (se necessário)**:
   - Se houver accounts/transactions criados com `entity_id` errado, será necessário:
     - Identificar quais accounts/transactions pertencem a qual entidade (baseado em `external_id` e conexão)
     - Reatribuir ou deletar dados incorretos
   - **ATENÇÃO**: Isso pode ser complexo se já houver dados sincronizados. Considere deletar e re-sincronizar.

4. **Re-sincronizar após correção**:
   - Após corrigir as conexões, execute sync em cada uma
   - Verifique que dados aparecem na entidade correta

---

### Opção 2: Encerrar Tenant e Criar Novo (Mais Limpo, Mas Perde Dados)

**Vantagens**:
- ✅ Estado limpo desde o início
- ✅ Migrations aplicadas corretamente
- ✅ Sem dados incorretos para limpar

**Desvantagens**:
- ❌ Perde histórico de conexões
- ❌ Perde dados já sincronizados (se houver)
- ❌ Requer reconectar todas as entidades via Pluggy

**Quando usar**:
- Se não houver dados importantes já sincronizados
- Se for mais rápido reconectar do que corrigir manualmente
- Se quiser garantir estado 100% limpo

**Passos**:
1. Fazer backup dos dados importantes (se houver)
2. Encerrar tenant atual
3. Criar novo tenant
4. Executar todas as migrations na ordem correta
5. Reconectar cada entidade via Pluggy (garantindo seleção correta de `entityId`)
6. Sincronizar cada conexão

---

## 🔧 COMO IDENTIFICAR QUAL CONEXÃO PERTENCE A QUAL ENTIDADE

### Método 1: Ordem de Criação + Teste Manual

1. Execute:
   ```sql
   SELECT 
     c.id,
     c.external_connection_id as pluggy_item_id,
     c.entity_id,
     e.legal_name,
     e.document,
     c.created_at
   FROM connections c
   JOIN entities e ON e.id = c.entity_id
   JOIN providers p ON p.id = c.provider_id
   JOIN provider_catalog pc ON pc.id = p.catalog_id
   WHERE pc.code = 'pluggy'
   ORDER BY c.created_at ASC;
   ```

2. Baseado na ordem de criação (`created_at`), identifique:
   - Primeira conexão criada → provavelmente PF ou primeira entidade conectada
   - Segunda conexão → provavelmente OLV
   - Terceira conexão → provavelmente XRP

3. **Validação**: Desconecte e reconecte cada entidade via Pluggy, anotando qual `itemId` foi retornado para cada uma.

### Método 2: Via Pluggy Dashboard

1. Acesse o dashboard do Pluggy
2. Veja os items criados e seus metadados
3. Identifique qual item pertence a qual CPF/CNPJ (se Pluggy armazena essa informação)

### Método 3: Via API Pluggy (se disponível)

1. Para cada `itemId`, chame a API do Pluggy:
   ```bash
   GET https://api.pluggy.ai/items/{itemId}
   ```
2. Verifique se a resposta contém CPF/CNPJ ou outros dados que permitam identificar a entidade

---

## 📋 CHECKLIST DE CORREÇÃO

### Antes de Começar
- [ ] Fazer backup do banco de dados
- [ ] Executar script de diagnóstico (PASSO 1 e 2)
- [ ] Identificar qual conexão pertence a qual entidade

### Correção
- [ ] Reatribuir conexão da PF ao `entity_id` correto
- [ ] Manter apenas 1 conexão da OLV (marcar outras como `revoked`)
- [ ] Reatribuir conexão da XRP ao `entity_id` correto
- [ ] Validar que cada entidade tem exatamente 1 conexão ativa

### Limpeza (se necessário)
- [ ] Identificar accounts/transactions com `entity_id` errado
- [ ] Reatribuir ou deletar dados incorretos
- [ ] Validar que não há dados "vazando" entre entidades

### Pós-Correção
- [ ] Re-sincronizar cada conexão
- [ ] Validar que dados aparecem na entidade correta
- [ ] Executar query de validação (PASSO 5 do script)
- [ ] Testar UI: verificar que cada entidade mostra apenas seus dados

---

## 🎯 RECOMENDAÇÃO FINAL

**Recomendo a Opção 1 (Correção Manual)** porque:
1. ✅ Preserva histórico e dados já sincronizados
2. ✅ Mais rápido que reconectar tudo
3. ✅ Permite validação passo a passo
4. ✅ Reversível (pode desfazer se necessário)

**Se optar pela Opção 2 (Criar Novo Tenant)**:
- Faça apenas se não houver dados importantes já sincronizados
- Garanta que o código já está corrigido (entityId obrigatório, validações, etc.)
- Reconecte cada entidade garantindo seleção correta na UI

---

## 📝 NOTAS IMPORTANTES

1. **O código já está corrigido**: As validações e idempotência já foram implementadas. O problema foi que as conexões foram criadas ANTES dessas correções.

2. **Prevenção futura**: Após corrigir, novas conexões serão criadas corretamente porque:
   - `entityId` é obrigatório na UI
   - Validação de workspace está ativa
   - Idempotência previne duplicatas

3. **Dados já sincronizados**: Se houver accounts/transactions já sincronizados com `entity_id` errado, será necessário:
   - Identificar qual account/transaction pertence a qual entidade (baseado em `external_id` e conexão)
   - Reatribuir ou deletar e re-sincronizar

4. **Teste após correção**: Sempre teste conectando uma nova entidade para garantir que o problema não ocorre mais.

---

**Script de correção**: `supabase/sql/mc10_fix_connections_entity_mapping.sql`

