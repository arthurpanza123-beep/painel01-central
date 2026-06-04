-- Central Play Plus - Supabase/Postgres schema
-- 002 - Core tables, foreign keys and updated_at triggers
-- This file only defines structure. Do not store real tokens or raw secrets.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  legacy_id text,
  name text,
  phone_e164 text,
  phone_raw text,
  telegram_chat_id bigint,
  telegram_user_id bigint,
  whatsapp_jid text,
  status public.client_status not null default 'lead',
  source text,
  duplicate_of uuid references public.clients(id) on delete set null,
  archived_reason text,
  notes text,
  legacy_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  category text not null default 'alternative',
  default_downloader_code text,
  supported_devices text[] not null default '{}'::text[],
  supports_downloader boolean not null default false,
  status public.integration_status not null default 'enabled',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.panels (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  kind text not null default 'api',
  base_url text,
  auth_type text not null default 'none',
  secret_ref text,
  env_keys text[] not null default '{}'::text[],
  supported_app_keys text[] not null default '{}'::text[],
  status public.integration_status not null default 'enabled',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  type text not null,
  base_url text,
  auth_type text,
  secret_ref text,
  status public.integration_status not null default 'enabled',
  last_check_at timestamptz,
  last_status text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.panel_credit_snapshots (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.panels(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  balance_label text,
  credits_available numeric,
  estimated_activations integer,
  cost_per_activation_cents integer,
  currency text not null default 'BRL',
  status text not null default 'ok',
  checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.panel_credit_snapshots is
  'Historical/latest credit snapshots for generation panels, used by Financeiro and Dashboard.';

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  channel text not null,
  category text not null,
  app_id uuid references public.apps(id) on delete set null,
  device_type text,
  title text,
  body text not null,
  media_url text,
  version integer not null default 1,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, channel, version)
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  app_id uuid references public.apps(id) on delete set null,
  panel_id uuid references public.panels(id) on delete set null,
  account_id uuid,
  device_type text,
  device_key text,
  provider text,
  provider_code text,
  status public.test_status not null default 'pending',
  source text,
  requested_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  legacy_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  source_test_id uuid references public.tests(id) on delete set null,
  app_id uuid not null references public.apps(id) on delete restrict,
  panel_id uuid references public.panels(id) on delete set null,
  username text,
  password_secret text,
  m3u_url_secret text,
  hls_url_secret text,
  device_key text,
  provider text,
  provider_code text,
  panel_external_id text,
  max_slots integer not null default 1 check (max_slots >= 1 and max_slots <= 10),
  status public.account_status not null default 'active',
  activated_at timestamptz,
  expires_at timestamptz,
  legacy_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tests
  drop constraint if exists tests_account_id_fkey;

alter table public.tests
  add constraint tests_account_id_fkey
  foreign key (account_id) references public.accounts(id) on delete set null;

create table if not exists public.account_slots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  slot_number integer not null check (slot_number >= 1),
  status public.slot_status not null default 'free',
  device_key text,
  assigned_at timestamptz,
  released_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, slot_number)
);

create table if not exists public.renewals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  slot_id uuid references public.account_slots(id) on delete set null,
  plan_key text not null,
  amount_cents integer,
  currency text not null default 'BRL',
  status public.renewal_status not null default 'draft',
  due_at timestamptz,
  paid_until timestamptz,
  confirmed_at timestamptz,
  operator_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  renewal_id uuid references public.renewals(id) on delete set null,
  integration_id uuid references public.integrations(id) on delete set null,
  external_id text,
  method text,
  amount_cents integer not null,
  currency text not null default 'BRL',
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  failed_at timestamptz,
  meta_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  test_id uuid references public.tests(id) on delete set null,
  type text not null,
  status public.problem_status not null default 'open',
  title text,
  description text,
  resolution text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  level public.log_level not null default 'info',
  event text not null,
  client_id uuid references public.clients(id) on delete set null,
  test_id uuid references public.tests(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  integration_id uuid references public.integrations(id) on delete set null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  template_id uuid references public.templates(id) on delete set null,
  integration_id uuid references public.integrations(id) on delete set null,
  channel text not null,
  direction text not null default 'outbound',
  to_address text,
  from_address text,
  status public.message_status not null default 'draft',
  subject text,
  body text,
  media_url text,
  external_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  from_status text,
  to_status text,
  operator_ref text,
  integration_id uuid references public.integrations(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.integrations(id) on delete set null,
  source text not null,
  external_event_id text,
  event_type text not null,
  status public.webhook_status not null default 'received',
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clients',
    'apps',
    'panels',
    'integrations',
    'templates',
    'tests',
    'accounts',
    'account_slots',
    'renewals',
    'payments',
    'problems',
    'messages'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;
