-- Estruturas duráveis para conversas de criação pelo WhatsApp.
-- Preparação manual: este arquivo não é aplicado automaticamente pela aplicação.

-- Não vinculados recebem somente orientação de vínculo, sem conta fictícia.
create table if not exists public.whatsapp_creation_ingress (
  id uuid primary key default gen_random_uuid(),
  instance_id text not null,
  message_id text not null,
  sender_phone text not null,
  reply_text text,
  status text not null default 'queued'
    check (status in ('queued', 'pending', 'sending', 'accepted', 'delivered', 'uncertain', 'failed')),
  lease_token uuid,
  lease_until timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique(instance_id, message_id)
);
create index if not exists idx_whatsapp_creation_ingress_pending
  on public.whatsapp_creation_ingress(created_at) where status = 'pending';

-- Recibos podem chegar antes do ACK da chamada HTTP de envio.
create table if not exists public.whatsapp_creation_receipts (
  instance_id text not null,
  sender_phone text not null,
  message_id text not null,
  delivered_at timestamptz not null default now(),
  primary key(instance_id, sender_phone, message_id)
);

create table if not exists public.whatsapp_creation_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  instance_id text not null,
  sender_phone text not null,
  revision integer not null default 0 check (revision >= 0),
  current_order_id uuid,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint whatsapp_creation_conversations_instance_sender_owner_unique
    unique (instance_id, sender_phone, owner_id),
  constraint whatsapp_creation_conversations_id_owner_unique
    unique (id, owner_id)
);

create table if not exists public.whatsapp_creation_orders (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  owner_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('encarte', 'video', 'cartaz', 'studio')),
  revision integer not null default 1 check (revision >= 1),
  state jsonb not null default '{}'::jsonb,
  status text not null default 'collecting'
    check (status in ('collecting', 'awaiting_images', 'awaiting_script', 'rendering', 'awaiting_preview', 'approved', 'delivered', 'failed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint whatsapp_creation_orders_conversation_owner_fk
    foreign key (conversation_id, owner_id)
    references public.whatsapp_creation_conversations(id, owner_id),
  constraint whatsapp_creation_orders_id_owner_unique
    unique (id, owner_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'whatsapp_creation_conversations_current_order_owner_fk'
       and conrelid = 'public.whatsapp_creation_conversations'::regclass
  ) then
    alter table public.whatsapp_creation_conversations
      add constraint whatsapp_creation_conversations_current_order_owner_fk
      foreign key (current_order_id, owner_id)
      references public.whatsapp_creation_orders(id, owner_id);
  end if;
end
$$;

create table if not exists public.whatsapp_creation_events (
  id uuid primary key default gen_random_uuid(),
  instance_id text not null,
  message_id text not null,
  conversation_id uuid not null,
  owner_id uuid not null references public.profiles(id),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed', 'ignored')),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint whatsapp_creation_events_instance_message_unique
    unique (instance_id, message_id),
  constraint whatsapp_creation_events_conversation_owner_fk
    foreign key (conversation_id, owner_id)
    references public.whatsapp_creation_conversations(id, owner_id)
);

create table if not exists public.whatsapp_creation_outbox (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  owner_id uuid not null references public.profiles(id),
  order_id uuid,
  idempotency_key text not null unique,
  type text not null check (type in ('text', 'image', 'document', 'video')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'accepted', 'delivered', 'uncertain', 'failed')),
  provider_message_id text,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default timezone('utc', now()),
  lease_token uuid,
  lease_until timestamptz,
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint whatsapp_creation_outbox_conversation_owner_fk
    foreign key (conversation_id, owner_id)
    references public.whatsapp_creation_conversations(id, owner_id),
  constraint whatsapp_creation_outbox_order_owner_fk
    foreign key (order_id, owner_id)
    references public.whatsapp_creation_orders(id, owner_id)
);

create table if not exists public.whatsapp_creation_theme_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  owner_id uuid not null references public.profiles(id),
  order_id uuid,
  theme text not null,
  formats jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'ready', 'cancelled')),
  scheduled_eta timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint whatsapp_creation_theme_requests_conversation_owner_fk
    foreign key (conversation_id, owner_id)
    references public.whatsapp_creation_conversations(id, owner_id),
  constraint whatsapp_creation_theme_requests_order_owner_fk
    foreign key (order_id, owner_id)
    references public.whatsapp_creation_orders(id, owner_id)
);

create index if not exists idx_whatsapp_creation_events_pending
  on public.whatsapp_creation_events (created_at, id)
  where status = 'pending';
create index if not exists idx_whatsapp_creation_events_expired_lease
  on public.whatsapp_creation_events (lease_until, id)
  where status = 'processing';
create index if not exists idx_whatsapp_creation_outbox_pending
  on public.whatsapp_creation_outbox (next_attempt_at, created_at, id)
  where status = 'pending';
create index if not exists idx_whatsapp_creation_outbox_expired_lease
  on public.whatsapp_creation_outbox (lease_until, id)
  where status = 'sending';
create index if not exists idx_whatsapp_creation_orders_owner_status
  on public.whatsapp_creation_orders (owner_id, status, updated_at desc);
create index if not exists idx_whatsapp_creation_theme_requests_pending
  on public.whatsapp_creation_theme_requests (scheduled_eta, created_at, id)
  where status in ('pending', 'scheduled');
