-- MC15: Fix para permitir contract_schedule_id NULL em debit_note_items
-- Permitir items adicionais (expenses/discounts) que não são vinculados a schedules

ALTER TABLE public.debit_note_items
  ALTER COLUMN contract_schedule_id DROP NOT NULL;

COMMENT ON COLUMN public.debit_note_items.contract_schedule_id IS 'ID do schedule vinculado. NULL = item adicional (expense/discount) não vinculado a schedule';
