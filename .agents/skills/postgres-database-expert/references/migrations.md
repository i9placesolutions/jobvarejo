# Migracoes SQL

## Arquivos em database/

| Arquivo | Resumo |
|---------|--------|
| `auth_local_password_migration.sql` | Adiciona password_hash, reset_token_hash, last_login_at em profiles |
| `dashboard_features_migration.sql` | Adiciona user_id, last_viewed, is_shared, is_starred em projects |
| `folders_migration.sql` | Cria tabela folders com hierarquia e RLS |
| `notifications_migration.sql` | Cria tabela notifications com trigger de sharing |
| `label_templates_migration.sql` | Cria tabela label_templates com JSONB group |
| `product_image_registry_migration.sql` | Cria tabela product_image_registry com status |
| `asset_names_migration.sql` | Cria tabela asset_names com PK composta |
| `asset_folders_migration.sql` | Cria tabela asset_folders com FK para folders |
| `prevent_empty_canvas_overwrite.sql` | Trigger de protecao contra overwrite vazio |
| `fix_projects_rls.sql` | Corrige RLS policies em projects |
| `update_existing_projects_user_id.sql` | Template para backfill de user_id |
| `POSTGRES_CUTOVER.md` | Runbook de migracao Supabase -> Coolify |

## Padrao de migracao

```sql
-- 1. DDL idempotente
CREATE TABLE IF NOT EXISTS public.nova_tabela (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- ... colunas
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Indices
CREATE INDEX IF NOT EXISTS idx_nova_tabela_user_id ON public.nova_tabela(user_id);

-- 3. Trigger de updated_at
CREATE OR REPLACE FUNCTION update_nova_tabela_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nova_tabela_updated_at ON public.nova_tabela;
CREATE TRIGGER trg_nova_tabela_updated_at
  BEFORE UPDATE ON public.nova_tabela
  FOR EACH ROW EXECUTE FUNCTION update_nova_tabela_updated_at();

-- 4. RLS (se aplicavel)
ALTER TABLE public.nova_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON public.nova_tabela
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own data" ON public.nova_tabela
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

## Scripts operacionais

| Script | Funcao |
|--------|--------|
| `scripts/db/smoke-test.sh` | Valida conectividade e compara source vs target |
| `scripts/db/incremental-sync-data.sh` | pg_dump/restore Supabase -> Coolify |
| `scripts/db/set-user-password.sh` | Define senha scrypt para um usuario |

## Cutover Supabase -> Coolify (resumo)

1. Schema ja migrado; app usa PG nativo + JWT local
2. Smoke test na target
3. Maintenance mode -> incremental sync (pg_dump data-only -> truncate -> pg_restore)
4. Smoke test novamente
5. Aplicar auth_local_password_migration
6. Set passwords via script
