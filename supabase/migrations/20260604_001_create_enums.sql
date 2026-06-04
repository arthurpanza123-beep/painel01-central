-- Central Play Plus - Supabase/Postgres schema
-- 001 - Domain enums
-- Safe to keep versioned. Does not contain credentials.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'client_status') then
    create type public.client_status as enum (
      'lead',
      'test_active',
      'active',
      'overdue',
      'archived',
      'blocked',
      'error',
      'duplicate'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'test_status') then
    create type public.test_status as enum (
      'pending',
      'generating',
      'active',
      'expired',
      'converted',
      'failed',
      'cancelled',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum (
      'provisioning',
      'active',
      'suspended',
      'expired',
      'cancelled',
      'error'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'slot_status') then
    create type public.slot_status as enum (
      'free',
      'reserved',
      'occupied',
      'released',
      'blocked'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'renewal_status') then
    create type public.renewal_status as enum (
      'draft',
      'pending_payment',
      'paid',
      'applied',
      'overdue',
      'cancelled',
      'failed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'pending',
      'paid',
      'failed',
      'refunded',
      'cancelled',
      'duplicate'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'problem_status') then
    create type public.problem_status as enum (
      'open',
      'investigating',
      'waiting_customer',
      'resolved',
      'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'message_status') then
    create type public.message_status as enum (
      'draft',
      'queued',
      'sent',
      'delivered',
      'failed',
      'skipped'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'integration_status') then
    create type public.integration_status as enum (
      'enabled',
      'disabled',
      'degraded',
      'error'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'webhook_status') then
    create type public.webhook_status as enum (
      'received',
      'processing',
      'processed',
      'failed',
      'ignored',
      'duplicate'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'log_level') then
    create type public.log_level as enum (
      'debug',
      'info',
      'warning',
      'error',
      'success'
    );
  end if;
end $$;
