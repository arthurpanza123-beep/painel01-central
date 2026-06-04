-- Central Play Plus - Supabase/Postgres schema
-- 005 - Public seeds for apps, panels and templates
-- No tokens, passwords, cookies, API keys or private URLs belong here.

insert into public.apps (
  key,
  name,
  category,
  default_downloader_code,
  supported_devices,
  supports_downloader,
  status,
  metadata
) values
  ('xcloud', 'XCloud', 'xcloud', null, array['android_tv','tv_box','fire_stick','mi_stick','lg','samsung','roku','ios','android_phone'], false, 'enabled', '{"notes":"Automated through XCloud Playwright when enabled."}'::jsonb),
  ('blessed', 'Blessed Player', 'alternative', '1105', array['android_tv','tv_box','fire_stick','mi_stick'], true, 'enabled', '{"public_code":"1105"}'::jsonb),
  ('playsim', 'PlaySim', 'alternative', '187052', array['android_tv','tv_box','fire_stick','mi_stick'], true, 'enabled', '{"public_code":"187052"}'::jsonb),
  ('assist_plus', 'Assist Plus', 'alternative', null, array['android_tv','tv_box','fire_stick','mi_stick'], true, 'enabled', '{}'::jsonb),
  ('funplay', 'Fun Play', 'alternative', '00112', array['android_tv','tv_box','fire_stick','mi_stick'], true, 'enabled', '{"public_code":"00112"}'::jsonb),
  ('magic', 'Magic Player', 'alternative', null, array['android_tv','tv_box','fire_stick','mi_stick'], true, 'disabled', '{"notes":"Keep disabled until the correct DevXTop/Magic API is confirmed."}'::jsonb),
  ('lotus', 'Lotus Player', 'alternative', '22', array['android_tv','tv_box','fire_stick','mi_stick'], true, 'enabled', '{"public_code":"22","notes":"Recommended when Ninety is not compatible with Blessed."}'::jsonb),
  ('hdplayer', 'HD Player', 'alternative', '3030', array['android_tv','tv_box','fire_stick','mi_stick'], true, 'disabled', '{"legacy_panel":"titanium"}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  default_downloader_code = excluded.default_downloader_code,
  supported_devices = excluded.supported_devices,
  supports_downloader = excluded.supports_downloader,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.panels (
  key,
  name,
  kind,
  base_url,
  auth_type,
  secret_ref,
  env_keys,
  supported_app_keys,
  status,
  metadata
) values
  ('ninety', 'Ninety', 'api', null, 'env_url', 'NINETY_API_URL', array['NINETY_API_URL'], array['xcloud','lotus'], 'enabled', '{"fallback_notes":"XCloud should try Ninety first."}'::jsonb),
  ('brasil_yellow', 'Brasil / Yellow Box', 'api', null, 'env_url', 'BRASILTV_API_URL', array['BRASILTV_API_URL'], array['xcloud','blessed','playsim','assist_plus'], 'enabled', '{"slot_rule":"Yellow Box may allow 2 slots when panel/app permits."}'::jsonb),
  ('uniplay', 'Uniplay', 'api', null, 'env_url', 'UNIPLAY_FUNPLAY_URL', array['UNIPLAY_FUNPLAY_URL'], array['funplay'], 'enabled', '{"public_code":"00112"}'::jsonb),
  ('devxtop_magic', 'DevXTop / Magic', 'api', null, 'env_url', 'DEVXTOP_MAGIC_URL', array['DEVXTOP_MAGIC_URL'], array['magic'], 'enabled', '{"notes":"Magic product remains possible; generation can stay disabled until confirmed."}'::jsonb),
  ('xcloud_playwright', 'XCloud Playwright', 'playwright', null, 'panel_login', 'XCLOUD_PANEL_CREDENTIALS', array['XCLOUD_PANEL_URL','XCLOUD_EMAIL','XCLOUD_PASSWORD'], array['xcloud'], 'enabled', '{"storage":"browser profile outside database"}'::jsonb),
  ('titanium', 'Titanium', 'api', null, 'env_url', null, array[]::text[], array['hdplayer'], 'disabled', '{"legacy":true}'::jsonb),
  ('areaplay', 'AreaPlay', 'api', null, 'env_url', null, array[]::text[], array['xcloud'], 'disabled', '{"legacy":true}'::jsonb),
  ('cinemax', 'CineMax', 'api', null, 'env_url', null, array[]::text[], array['blessed','playsim','assist_plus','funplay'], 'disabled', '{"legacy":true}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  kind = excluded.kind,
  base_url = excluded.base_url,
  auth_type = excluded.auth_type,
  secret_ref = excluded.secret_ref,
  env_keys = excluded.env_keys,
  supported_app_keys = excluded.supported_app_keys,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.integrations (
  key,
  name,
  type,
  base_url,
  auth_type,
  secret_ref,
  status,
  config
) values
  ('evolution_api', 'Evolution API', 'whatsapp', null, 'api_key', 'EVOLUTION_API_KEY', 'enabled', '{"send_enabled":false}'::jsonb),
  ('telegram_bot', 'Telegram Bot', 'telegram', null, 'bot_token', 'TELEGRAM_BOT_TOKEN', 'enabled', '{"send_enabled":false}'::jsonb),
  ('meta_capi', 'Meta CAPI', 'analytics', null, 'access_token', 'META_CAPI_ACCESS_TOKEN', 'enabled', '{"send_enabled":false}'::jsonb),
  ('supabase', 'Supabase', 'database', null, 'service_role', 'SUPABASE_SERVICE_ROLE_KEY', 'enabled', '{"migrations_applied":false}'::jsonb),
  ('pm2_vps', 'PM2 / VPS', 'infra', null, 'none', null, 'enabled', '{}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  type = excluded.type,
  base_url = excluded.base_url,
  auth_type = excluded.auth_type,
  secret_ref = excluded.secret_ref,
  status = excluded.status,
  config = excluded.config,
  updated_at = now();

insert into public.templates (
  key,
  channel,
  category,
  title,
  body,
  version,
  active,
  metadata
) values
  ('test_activated', 'whatsapp', 'test', 'Teste ativado', 'Teste ativado com sucesso!\n\nApp: {{app_name}}\nCodigo: {{app_code}}\nUsuario: {{username}}\nSenha: {{password}}\nValidade: {{expires_at}}', 1, true, '{}'::jsonb),
  ('access_activated', 'whatsapp', 'activation', 'Acesso ativado', 'Acesso ativado com sucesso!\n\nApp: {{app_name}}\nUsuario: {{username}}\nSenha: {{password}}\nVencimento: {{expires_at}}', 1, true, '{}'::jsonb),
  ('renewal_due', 'whatsapp', 'renewal', 'Renovacao', 'Ola {{client_name}}! Seu acesso vence em {{due_at}}. Plano {{plan_key}}: R$ {{amount}}.', 1, true, '{}'::jsonb),
  ('payment_confirmed', 'whatsapp', 'payment', 'Pagamento confirmado', 'Pagamento confirmado com sucesso!\n\nCliente: {{client_name}}\nPlano: {{plan_key}}\nVencimento: {{paid_until}}', 1, true, '{}'::jsonb),
  ('install_downloader', 'whatsapp', 'install', 'Instalacao via Downloader', 'Para instalar no {{device_type}}, abra o Downloader e use o codigo {{app_code}}.', 1, true, '{}'::jsonb),
  ('welcome', 'whatsapp', 'welcome', 'Boas-vindas', 'Ola! Seja bem-vindo a Central Play Plus. Me diga seu aparelho para eu enviar o passo a passo correto.', 1, true, '{}'::jsonb),
  ('support_problem', 'whatsapp', 'support', 'Suporte', 'Recebemos seu chamado: {{problem_type}}. Ja estamos verificando.', 1, true, '{}'::jsonb)
on conflict (key, channel, version) do update set
  category = excluded.category,
  title = excluded.title,
  body = excluded.body,
  active = excluded.active,
  metadata = excluded.metadata,
  updated_at = now();
