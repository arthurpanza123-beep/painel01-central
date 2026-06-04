-- Central Play Plus - Supabase/Postgres schema
-- 003 - Operational indexes

create index if not exists idx_clients_phone_e164 on public.clients (phone_e164);
create index if not exists idx_clients_telegram_chat_id on public.clients (telegram_chat_id);
create index if not exists idx_clients_telegram_user_id on public.clients (telegram_user_id);
create index if not exists idx_clients_whatsapp_jid on public.clients (whatsapp_jid);
create index if not exists idx_clients_status on public.clients (status);
create index if not exists idx_clients_duplicate_of on public.clients (duplicate_of);
create index if not exists idx_clients_created_at on public.clients (created_at desc);

create index if not exists idx_apps_key on public.apps (key);
create index if not exists idx_apps_category on public.apps (category);
create index if not exists idx_apps_status on public.apps (status);

create index if not exists idx_panels_key on public.panels (key);
create index if not exists idx_panels_kind on public.panels (kind);
create index if not exists idx_panels_status on public.panels (status);

create index if not exists idx_integrations_key on public.integrations (key);
create index if not exists idx_integrations_type on public.integrations (type);
create index if not exists idx_integrations_status on public.integrations (status);

create index if not exists idx_panel_credit_snapshots_panel_id on public.panel_credit_snapshots (panel_id);
create index if not exists idx_panel_credit_snapshots_integration_id on public.panel_credit_snapshots (integration_id);
create index if not exists idx_panel_credit_snapshots_checked_at on public.panel_credit_snapshots (checked_at desc);
create index if not exists idx_panel_credit_snapshots_status on public.panel_credit_snapshots (status);

create index if not exists idx_templates_key on public.templates (key);
create index if not exists idx_templates_channel on public.templates (channel);
create index if not exists idx_templates_category on public.templates (category);
create index if not exists idx_templates_app_id on public.templates (app_id);
create index if not exists idx_templates_active on public.templates (active);

create index if not exists idx_tests_client_id on public.tests (client_id);
create index if not exists idx_tests_app_id on public.tests (app_id);
create index if not exists idx_tests_panel_id on public.tests (panel_id);
create index if not exists idx_tests_account_id on public.tests (account_id);
create index if not exists idx_tests_status on public.tests (status);
create index if not exists idx_tests_expires_at on public.tests (expires_at);
create index if not exists idx_tests_device_key on public.tests (device_key);
create index if not exists idx_tests_provider on public.tests (provider);
create index if not exists idx_tests_created_at on public.tests (created_at desc);

create index if not exists idx_accounts_client_id on public.accounts (client_id);
create index if not exists idx_accounts_source_test_id on public.accounts (source_test_id);
create index if not exists idx_accounts_app_id on public.accounts (app_id);
create index if not exists idx_accounts_panel_id on public.accounts (panel_id);
create index if not exists idx_accounts_username on public.accounts (username);
create index if not exists idx_accounts_device_key on public.accounts (device_key);
create index if not exists idx_accounts_status on public.accounts (status);
create index if not exists idx_accounts_expires_at on public.accounts (expires_at);

create index if not exists idx_account_slots_account_id on public.account_slots (account_id);
create index if not exists idx_account_slots_client_id on public.account_slots (client_id);
create index if not exists idx_account_slots_status on public.account_slots (status);
create index if not exists idx_account_slots_expires_at on public.account_slots (expires_at);

create index if not exists idx_renewals_client_id on public.renewals (client_id);
create index if not exists idx_renewals_account_id on public.renewals (account_id);
create index if not exists idx_renewals_slot_id on public.renewals (slot_id);
create index if not exists idx_renewals_status on public.renewals (status);
create index if not exists idx_renewals_due_at on public.renewals (due_at);
create index if not exists idx_renewals_paid_until on public.renewals (paid_until);
create index if not exists idx_renewals_plan_key on public.renewals (plan_key);

create index if not exists idx_payments_client_id on public.payments (client_id);
create index if not exists idx_payments_renewal_id on public.payments (renewal_id);
create index if not exists idx_payments_integration_id on public.payments (integration_id);
create index if not exists idx_payments_status on public.payments (status);
create index if not exists idx_payments_paid_at on public.payments (paid_at);
create index if not exists idx_payments_external_id on public.payments (external_id);
create index if not exists idx_payments_meta_event_id on public.payments (meta_event_id);

create index if not exists idx_problems_client_id on public.problems (client_id);
create index if not exists idx_problems_account_id on public.problems (account_id);
create index if not exists idx_problems_test_id on public.problems (test_id);
create index if not exists idx_problems_status on public.problems (status);
create index if not exists idx_problems_type on public.problems (type);
create index if not exists idx_problems_opened_at on public.problems (opened_at desc);

create index if not exists idx_logs_scope on public.logs (scope);
create index if not exists idx_logs_level on public.logs (level);
create index if not exists idx_logs_event on public.logs (event);
create index if not exists idx_logs_client_id on public.logs (client_id);
create index if not exists idx_logs_test_id on public.logs (test_id);
create index if not exists idx_logs_account_id on public.logs (account_id);
create index if not exists idx_logs_integration_id on public.logs (integration_id);
create index if not exists idx_logs_created_at on public.logs (created_at desc);

create index if not exists idx_messages_client_id on public.messages (client_id);
create index if not exists idx_messages_template_id on public.messages (template_id);
create index if not exists idx_messages_integration_id on public.messages (integration_id);
create index if not exists idx_messages_channel on public.messages (channel);
create index if not exists idx_messages_status on public.messages (status);
create index if not exists idx_messages_external_message_id on public.messages (external_message_id);
create index if not exists idx_messages_sent_at on public.messages (sent_at desc);
create index if not exists idx_messages_created_at on public.messages (created_at desc);

create index if not exists idx_pipeline_events_entity on public.pipeline_events (entity_type, entity_id);
create index if not exists idx_pipeline_events_event_type on public.pipeline_events (event_type);
create index if not exists idx_pipeline_events_integration_id on public.pipeline_events (integration_id);
create index if not exists idx_pipeline_events_created_at on public.pipeline_events (created_at desc);

create index if not exists idx_webhook_events_source on public.webhook_events (source);
create index if not exists idx_webhook_events_event_type on public.webhook_events (event_type);
create index if not exists idx_webhook_events_status on public.webhook_events (status);
create index if not exists idx_webhook_events_received_at on public.webhook_events (received_at desc);
create unique index if not exists idx_webhook_events_idempotency_key_unique
  on public.webhook_events (idempotency_key)
  where idempotency_key is not null;
