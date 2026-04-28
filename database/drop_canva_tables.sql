-- ============================================================================
-- Remove tabelas residuais da integracao Canva (removida do codigo)
-- ============================================================================
-- Aplicar manualmente no Postgres apos confirmar que nada mais le essas tabelas.
-- Ordem segura: filhas antes das pais (FK), depois indices implicitos caem junto.
-- Use IF EXISTS para nao falhar se algum ambiente nunca rodou as migracoes.

BEGIN;

DROP TABLE IF EXISTS canva_template_companions CASCADE;
DROP TABLE IF EXISTS canva_designs CASCADE;
DROP TABLE IF EXISTS canva_folders CASCADE;
DROP TABLE IF EXISTS canva_templates CASCADE;
DROP TABLE IF EXISTS canva_oauth_tokens CASCADE;

COMMIT;
