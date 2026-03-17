# Schema do Banco de Dados

## Tabelas

### public.profiles
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID | PK |
| email | text | unique index em lower(email) |
| name | text | |
| avatar_url | text | |
| user_role | user_role enum | 'super_admin', 'admin', 'user' |
| password_hash | text | scrypt format |
| reset_token_hash | text | SHA-256, indexed |
| reset_token_expires_at | timestamptz | |
| last_login_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | trigger |

### public.projects
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK profiles, indexed |
| name | text | |
| canvas_data | JSONB | array de paginas |
| preview_url | text | |
| folder_id | UUID | FK folders, nullable |
| is_shared | boolean | indexed |
| shared_with | text[] | |
| is_starred | boolean | indexed |
| last_viewed | timestamptz | indexed |
| updated_at | timestamptz | trigger |
| created_at | timestamptz | |

**Trigger:** `prevent_empty_canvas_overwrite` - impede UPDATE que troca array nao-vazio por vazio.
**RLS:** SELECT/INSERT/UPDATE/DELETE scoped a `user_id`.

### public.folders
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK profiles |
| parent_id | UUID | FK folders (self-ref), nullable |
| name | text | |
| icon | text | |
| color | text | |
| order_index | integer | |
| created_at | timestamptz | |
| updated_at | timestamptz | trigger |

**RLS:** Full policies scoped a `user_id`.
**Funcao:** `get_user_folder_count(user_id)`.

### public.notifications
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK profiles |
| title | text | |
| message | text | |
| type | text | |
| read | boolean | |
| metadata | JSONB | |
| created_at | timestamptz | |
| updated_at | timestamptz | trigger |

**Trigger:** `notify_project_shared` - cria notificacao quando `is_shared` muda em projects.

### public.label_templates
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | text | PK |
| user_id | UUID | |
| name | text | |
| kind | text | |
| "group" | JSONB | (coluna com aspas por ser reserved word) |
| preview_data_url | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | trigger |

### public.asset_names
| Coluna | Tipo | Notas |
|--------|------|-------|
| user_id | UUID | PK composta |
| asset_key | text | PK composta |
| display_name | text | |

### public.asset_folders
| Coluna | Tipo | Notas |
|--------|------|-------|
| user_id | UUID | PK composta |
| asset_key | text | PK composta |
| folder_id | UUID | FK folders |

### public.product_image_cache
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID | PK |
| search_term | text | unique |
| product_name | text | |
| brand | text | |
| s3_key | text | |
| source | text | |
| usage_count | integer | ORDER BY para popularidade |
| created_at | timestamptz | |

### public.product_image_registry
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | bigserial | PK |
| product_identity_key | text | unique index |
| status | text | CHECK: approved, review_pending, rejected |
| s3_key | text | |
| validation_level | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

## Conexao

```ts
// server/utils/postgres.ts
const pool = new Pool({
  connectionString,  // POSTGRES_DATABASE_URL > DATABASE_URL > NUXT_* > TARGET_*
  max: 10,           // POSTGRES_POOL_MAX (max 30)
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: isSslRequired ? { rejectUnauthorized: false } : undefined
})
```

## API de query

```ts
pgQuery<T>(text: string, params?: any[]): Promise<QueryResult<T>>
pgOneOrNull<T>(text: string, params?: any[]): Promise<T | null>
pgTx<T>(run: (client: PoolClient) => Promise<T>): Promise<T>
```
