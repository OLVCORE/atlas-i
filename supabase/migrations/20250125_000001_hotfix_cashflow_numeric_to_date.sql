-- HOTFIX: Corrigir erro "cannot cast type numeric to date" na função get_monthly_cashflow_matrix
-- O problema estava no cálculo da data de pagamento dos card_installments
-- EXTRACT(DAY FROM ...) retorna double precision, que precisa ser convertido para integer antes de somar com date

CREATE OR REPLACE FUNCTION public.get_monthly_cashflow_matrix(
  p_workspace_id uuid,
  p_from_month date,
  p_to_month date,
  p_entity_id uuid DEFAULT NULL,
  p_account_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_user_id uuid;
BEGIN
  -- Validar que o usuário pertence ao workspace
  SELECT auth.uid() INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado: workspace não encontrado ou sem permissão';
  END IF;
  
  -- Validar intervalo
  IF p_from_month > p_to_month THEN
    RAISE EXCEPTION 'Data inicial deve ser menor ou igual à data final';
  END IF;
  
  -- Gerar série mensal e calcular agregações
  WITH month_series AS (
    SELECT 
      generate_series(
        date_trunc('month', p_from_month),
        date_trunc('month', p_to_month),
        '1 month'::interval
      )::date AS month_start
  ),
  -- Previsto: schedules PLANNED (não cancelled, sem linked_transaction)
  planned_data AS (
    SELECT 
      date_trunc('month', fs.due_date)::date AS month_start,
      SUM(CASE 
        WHEN fc.type = 'revenue' THEN fs.amount 
        ELSE 0 
      END) AS planned_income,
      SUM(CASE 
        WHEN fc.type = 'expense' THEN fs.amount 
        ELSE 0 
      END) AS planned_expense
    FROM public.financial_schedules fs
    INNER JOIN public.financial_commitments fc ON fs.commitment_id = fc.id
    WHERE fs.workspace_id = p_workspace_id
      AND fs.status = 'planned'
      AND fs.linked_transaction_id IS NULL
      AND fs.deleted_at IS NULL
      AND fc.deleted_at IS NULL
      AND date_trunc('month', fs.due_date)::date >= p_from_month
      AND date_trunc('month', fs.due_date)::date <= p_to_month
      AND (p_entity_id IS NULL OR fc.entity_id = p_entity_id)
    GROUP BY date_trunc('month', fs.due_date)::date
    
    UNION ALL
    
    -- Contract schedules PLANNED
    SELECT 
      date_trunc('month', cs.due_date)::date AS month_start,
      SUM(CASE 
        WHEN cs.type = 'receivable' THEN cs.amount 
        ELSE 0 
      END) AS planned_income,
      SUM(CASE 
        WHEN cs.type = 'payable' THEN cs.amount 
        ELSE 0 
      END) AS planned_expense
    FROM public.contract_schedules cs
    INNER JOIN public.contracts c ON cs.contract_id = c.id
    WHERE cs.workspace_id = p_workspace_id
      AND cs.status = 'planned'
      AND cs.linked_transaction_id IS NULL
      AND cs.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND date_trunc('month', cs.due_date)::date >= p_from_month
      AND date_trunc('month', cs.due_date)::date <= p_to_month
      AND (p_entity_id IS NULL OR c.counterparty_entity_id = p_entity_id)
    GROUP BY date_trunc('month', cs.due_date)::date
    
    UNION ALL
    
    -- Card installments PLANNED (scheduled, não posted)
    -- FIX: Converter EXTRACT(DAY FROM ...) para integer antes de somar com date
    SELECT 
      date_trunc('month', 
        (date_trunc('month', ci.competence_month)::date + 
         (LEAST(c.due_day::integer, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::integer) - 1)
        )
      )::date AS month_start,
      0 AS planned_income, -- Cartões são sempre despesas
      SUM(ci.amount) AS planned_expense
    FROM public.card_installments ci
    INNER JOIN public.cards c ON ci.card_id = c.id
    WHERE ci.workspace_id = p_workspace_id
      AND ci.status = 'scheduled'
      AND ci.posted_transaction_id IS NULL
      -- Filtrar por mês de pagamento calculado
      AND date_trunc('month', 
        (date_trunc('month', ci.competence_month)::date + 
         (LEAST(c.due_day::integer, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::integer) - 1)
        )
      )::date >= p_from_month
      AND date_trunc('month', 
        (date_trunc('month', ci.competence_month)::date + 
         (LEAST(c.due_day::integer, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::integer) - 1)
        )
      )::date <= p_to_month
      AND (p_entity_id IS NULL OR ci.entity_id = p_entity_id)
    GROUP BY date_trunc('month', 
      (date_trunc('month', ci.competence_month)::date + 
       (LEAST(c.due_day, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::date))::integer - 1
      )
    )::date
  ),
  planned_agg AS (
    SELECT 
      month_start,
      COALESCE(SUM(planned_income), 0) AS planned_income,
      COALESCE(SUM(planned_expense), 0) AS planned_expense
    FROM planned_data
    GROUP BY month_start
  ),
  -- Realizado: transactions (não reversed)
  -- Inclui transações vinculadas a card_installments (posted)
  realised_data AS (
    SELECT 
      date_trunc('month', t.date)::date AS month_start,
      SUM(CASE 
        WHEN t.type = 'income' THEN ABS(t.amount)
        ELSE 0 
      END) AS realised_income,
      SUM(CASE 
        WHEN t.type = 'expense' THEN ABS(t.amount)
        ELSE 0 
      END) AS realised_expense
    FROM public.transactions t
    WHERE t.workspace_id = p_workspace_id
      AND t.reversed_by_id IS NULL
      AND date_trunc('month', t.date)::date >= p_from_month
      AND date_trunc('month', t.date)::date <= p_to_month
      AND (p_entity_id IS NULL OR t.entity_id = p_entity_id)
      AND (p_account_id IS NULL OR t.account_id = p_account_id)
    GROUP BY date_trunc('month', t.date)::date
  ),
  -- Combinar meses e calcular acumulado
  monthly_data AS (
    SELECT 
      ms.month_start,
      COALESCE(pa.planned_income, 0) AS planned_income,
      COALESCE(pa.planned_expense, 0) AS planned_expense,
      COALESCE(rd.realised_income, 0) AS realised_income,
      COALESCE(rd.realised_expense, 0) AS realised_expense,
      COALESCE(pa.planned_income, 0) - COALESCE(pa.planned_expense, 0) AS planned_net,
      COALESCE(rd.realised_income, 0) - COALESCE(rd.realised_expense, 0) AS realised_net
    FROM month_series ms
    LEFT JOIN planned_agg pa ON ms.month_start = pa.month_start
    LEFT JOIN realised_data rd ON ms.month_start = rd.month_start
    ORDER BY ms.month_start
  ),
  -- Calcular acumulado
  with_cumulative AS (
    SELECT 
      month_start,
      planned_income,
      planned_expense,
      planned_net,
      realised_income,
      realised_expense,
      realised_net,
      SUM(planned_net) OVER (ORDER BY month_start) AS planned_cum,
      SUM(realised_net) OVER (ORDER BY month_start) AS realised_cum
    FROM monthly_data
  ),
  -- Calcular worst balance por mês (determinístico)
  with_worst_balance AS (
    SELECT 
      month_start,
      planned_cum,
      realised_cum,
      LEAST(planned_cum, realised_cum) AS worst_balance
    FROM with_cumulative
  ),
  -- Encontrar mínimo balance e primeiro mês que atinge (determinístico)
  min_cum AS (
    SELECT 
      MIN(worst_balance) AS min_cum_balance
    FROM with_worst_balance
  ),
  min_cum_month_row AS (
    SELECT 
      month_start AS min_cum_month
    FROM with_worst_balance, min_cum
    WHERE worst_balance = min_cum.min_cum_balance
    ORDER BY month_start
    LIMIT 1
  )
  SELECT json_build_object(
    'months', json_agg(
      json_build_object(
        'month_start', month_start,
        'planned_income', planned_income,
        'planned_expense', planned_expense,
        'planned_net', planned_net,
        'realised_income', realised_income,
        'realised_expense', realised_expense,
        'realised_net', realised_net,
        'planned_cum', planned_cum,
        'realised_cum', realised_cum
      ) ORDER BY month_start
    ),
    'metadata', (
      SELECT json_build_object(
        'min_cum_balance', mc.min_cum_balance,
        'min_cum_month', mcm.min_cum_month
      )
      FROM min_cum mc
      LEFT JOIN LATERAL (
        SELECT min_cum_month FROM min_cum_month_row LIMIT 1
      ) mcm ON TRUE
    )
  ) INTO v_result
  FROM with_cumulative;
  
  RETURN COALESCE(v_result, '{"months": [], "metadata": {"min_cum_balance": null, "min_cum_month": null}}'::json);
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.get_monthly_cashflow_matrix IS 'Retorna matriz mensal de fluxo de caixa (previsto vs realizado) incluindo card_installments com RLS aplicado. HOTFIX: corrigido cast de numeric para date';
