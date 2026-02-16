# Recriar projeto Supabase do zero (ex.: banco deletado)

Se o projeto Supabase foi deletado e você precisa voltar a usar o app (por exemplo, só **notas de débito**), crie um **novo projeto** e aplique todas as migrations na ordem abaixo.

## 1. Criar novo projeto no Supabase

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard) e faça login.
2. **New project** → escolha organização, nome (ex: `atlas-i`), senha do DB, região.
3. Aguarde o projeto ficar **Active**.

## 2. Configurar variáveis de ambiente

1. No projeto novo: **Settings** (ícone engrenagem) → **API**.
2. Copie:
   - **Project URL** → use em `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** (em Project API keys) → use em `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. No seu projeto local, edite o arquivo **`.env.local`** (na raiz do atlas-i):

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...sua-chave-anon...
```

4. Reinicie o servidor (`npm run dev`) depois de salvar.

## 3. Rodar todas as migrations (ordem obrigatória)

Para **notas de débito** funcionarem, o app precisa de workspace, contratos e cronogramas. Por isso é necessário rodar **todas** as migrations, na ordem abaixo (cada uma depende da anterior).

### Opção A: Supabase CLI (recomendado)

```bash
# Na raiz do projeto (atlas-i)
npx supabase link --project-ref SEU-PROJECT-REF
npx supabase db push
```

O `project-ref` é a parte da URL antes de `.supabase.co` (ex: `abcdefghijk` em `https://abcdefghijk.supabase.co`).

### Opção B: SQL Editor (Dashboard)

No Supabase: **SQL Editor** → New query. Para **cada** arquivo abaixo, na ordem:

1. Abra o arquivo em `supabase/migrations/`
2. Copie todo o conteúdo
3. Cole no SQL Editor e execute (Run)

**Ordem das migrations:**

| # | Arquivo |
|---|---------|
| 1 | `20251220_000001_mc1_workspaces.sql` |
| 2 | `20251220_000002_mc2_core.sql` |
| 3 | `20251221_000003_mc2_1_entity_enrichment.sql` |
| 4 | `20251221_000004_mc3_cards_installments.sql` |
| 5 | `20251221_000005_mc3_1_connectors_foundation.sql` |
| 6 | `20251221_000006_mc3_1b_provider_catalog.sql` |
| 7 | `20251221_000007_mc4_1_commitments_contracts.sql` |
| 8 | `20251221_000008_mc4_1_rls_insert_fix.sql` |
| 9 | `20251221_000009_mc4_3_3_audit_softdelete.sql` |
| 10 | `20251221_000010_mc5_transaction_reversal.sql` |
| 11 | `20251221_000011_mc6_monthly_cashflow.sql` |
| 12 | `20251221_000012_hotfix_cashflow_tx_status.sql` |
| 13 | `20251221_000013_mc62_account_opening_balance.sql` |
| 14 | `20251221_000014_mc8_operational_movements.sql` |
| 15 | `20251222_000001_mc9_alerts.sql` |
| 16 | `20250101_000001_mc10_pluggy_source_fields.sql` |
| 17 | `20250101_000002_mc10_unique_constraints.sql` |
| 18 | `20250101_000003_mc10_connections_unique.sql` |
| 19 | `20250101_000004_mc10_cleanup_duplicates.sql` |
| 20 | `20250102_000001_mc11_cashflow_cards.sql` |
| 21 | `20250103_000001_mc13_scrapers.sql` |
| 22 | `20250124_000001_mc14_debit_notes.sql` |
| 23 | `20250125_000001_hotfix_cashflow_numeric_to_date.sql` |
| 24 | `20250125_000002_contracts_improvements.sql` |
| 25 | `20250125_000003_fix_contract_schedules_deleted_at.sql` |
| 26 | `20250125_000004_contract_line_items.sql` |
| 27 | `20250125_000005_fix_debit_note_items_nullable.sql` |
| 28 | `20250126_000001_accounts_soft_delete.sql` |
| 29 | `20250126_000002_fix_debit_note_items_rls.sql` |
| 30 | `20250126_000003_debit_notes_soft_delete.sql` |
| 31 | `20250126_000004_debit_notes_client_notes.sql` |
| 32 | `20250126_000005_debit_note_items_commitment_ref.sql` |
| 33 | `FIX_DELETE_VERCEL.sql` |

## 4. Auth (login) e primeiro uso

- O Supabase já vem com **Auth** ativo; você pode se cadastrar pelo app (rota de signup/login).
- Para usar **notas de débito**: crie um **workspace**, depois **entidade**, **contrato** e **cronograma** conforme o fluxo do app; em seguida use a funcionalidade de criação de notas de débito.

## Resumo

| Passo | Ação |
|-------|------|
| 1 | Criar novo projeto no Supabase |
| 2 | Atualizar `.env.local` com URL e anon key do projeto novo |
| 3 | Rodar todas as migrations na ordem (CLI `db push` ou SQL Editor) |
| 4 | Reiniciar `npm run dev` e testar login + notas de débito |

As migrations são idempotentes: rodar de novo por engano não costuma quebrar; o importante é **não pular** nenhuma e manter a **ordem** acima.
