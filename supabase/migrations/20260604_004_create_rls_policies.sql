-- Central Play Plus - Supabase/Postgres schema
-- 004 - RLS baseline for staging
--
-- IMPORTANT:
-- These policies are intentionally permissive for an initial private staging
-- panel. Before production with user accounts, replace them with role-based
-- policies scoped by operator/admin permissions.
--
-- Service role still bypasses RLS. Do not expose service role keys to clients.

alter table public.clients enable row level security;
alter table public.apps enable row level security;
alter table public.panels enable row level security;
alter table public.tests enable row level security;
alter table public.accounts enable row level security;
alter table public.account_slots enable row level security;
alter table public.renewals enable row level security;
alter table public.payments enable row level security;
alter table public.problems enable row level security;
alter table public.integrations enable row level security;
alter table public.panel_credit_snapshots enable row level security;
alter table public.logs enable row level security;
alter table public.messages enable row level security;
alter table public.pipeline_events enable row level security;
alter table public.templates enable row level security;
alter table public.webhook_events enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clients',
    'apps',
    'panels',
    'tests',
    'accounts',
    'account_slots',
    'renewals',
    'payments',
    'problems',
    'integrations',
    'panel_credit_snapshots',
    'logs',
    'messages',
    'pipeline_events',
    'templates',
    'webhook_events'
  ]
  loop
    execute format('drop policy if exists "staging authenticated read %I" on public.%I', table_name, table_name);
    execute format('drop policy if exists "staging authenticated write %I" on public.%I', table_name, table_name);

    execute format(
      'create policy "staging authenticated read %I" on public.%I for select to authenticated using (true)',
      table_name,
      table_name
    );

    execute format(
      'create policy "staging authenticated write %I" on public.%I for all to authenticated using (true) with check (true)',
      table_name,
      table_name
    );
  end loop;
end $$;

-- Public anonymous access is intentionally not granted.
-- Add anon read policies only for explicitly public data after auth design.
