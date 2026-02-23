create table if not exists public.product_image_registry (
  id bigserial primary key,
  product_code text null,
  product_identity_key text not null,
  canonical_name text null,
  brand text null,
  flavor text null,
  weight text null,
  s3_key text null,
  source text null,
  validation_level text null,
  validated_at timestamptz null,
  validated_by text null,
  status text not null default 'review_pending' check (status in ('approved', 'review_pending', 'rejected')),
  reason text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists product_image_registry_identity_key_uidx
  on public.product_image_registry (product_identity_key);

create index if not exists product_image_registry_product_code_idx
  on public.product_image_registry (product_code);

create index if not exists product_image_registry_status_updated_idx
  on public.product_image_registry (status, updated_at desc);
