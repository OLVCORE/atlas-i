-- ATLAS-i MC4.4 - Auditoria SQL/RLS
-- Script somente leitura para diagnóstico de tabelas, RLS e policies
-- Execute no Supabase SQL Editor para verificar o estado atual do schema

-- ========================================
-- 1) LISTAR TABELAS DO SCHEMA PUBLIC (ATLAS-i)
-- ========================================
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE '_prisma%'
ORDER BY table_name;

-- ========================================
-- 2) VERIFICAR RLS HABILITADO POR TABELA
-- ========================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma%'
ORDER BY tablename;

-- ========================================
-- 3) LISTAR POLICIES POR TABELA (RLS)
-- ========================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,  -- SELECT, INSERT, UPDATE, DELETE
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma%'
ORDER BY tablename, policyname;

-- ========================================
-- 4) VERIFICAR COLUNAS DE GOVERNANÇA (soft delete, audit)
-- ========================================
-- Verificar se tabelas principais têm deleted_at, created_at, updated_at
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND column_name IN ('deleted_at', 'deleted_by', 'created_at', 'updated_at', 'workspace_id', 'entity_id')
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE '_prisma%'
ORDER BY table_name, column_name;

-- ========================================
-- 5) RESUMO DE TABELAS COM RLS E POLICIES
-- ========================================
SELECT 
    t.tablename,
    CASE WHEN t.rowsecurity THEN 'SIM' ELSE 'NÃO' END as rls_enabled,
    COUNT(DISTINCT p.policyname) as total_policies,
    COUNT(DISTINCT CASE WHEN p.cmd = 'SELECT' THEN p.policyname END) as select_policies,
    COUNT(DISTINCT CASE WHEN p.cmd = 'INSERT' THEN p.policyname END) as insert_policies,
    COUNT(DISTINCT CASE WHEN p.cmd = 'UPDATE' THEN p.policyname END) as update_policies,
    COUNT(DISTINCT CASE WHEN p.cmd = 'DELETE' THEN p.policyname END) as delete_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%'
    AND t.tablename NOT LIKE '_prisma%'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- ========================================
-- 6) VERIFICAR ÍNDICES RELEVANTES (performance)
-- ========================================
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma%'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ========================================
-- 7) VERIFICAR FOREIGN KEYS (integridade referencial)
-- ========================================
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name NOT LIKE 'pg_%'
    AND tc.table_name NOT LIKE '_prisma%'
ORDER BY tc.table_name, kcu.column_name;

-- ========================================
-- NOTAS:
-- - Este script é SOMENTE LEITURA (não altera nada)
-- - Execute cada seção separadamente ou todas juntas
-- - Se encontrar lacunas (RLS desabilitado, policies faltando), reportar para MC5
-- ========================================

