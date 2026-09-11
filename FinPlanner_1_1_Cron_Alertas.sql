
-- ============================================================
-- FinPlanner 1.1 - Exemplo de agendamento diário de alertas
-- Configure primeiro os Secrets da Edge Function.
-- Ajuste a hora conforme sua preferência.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- Crie os segredos UMA vez, substituindo os valores:
-- select vault.create_secret('https://SEU-PROJETO.supabase.co', 'finplanner_project_url');
-- select vault.create_secret('SEU_CRON_SECRET', 'finplanner_cron_secret');

-- Exemplo: 11:00 UTC = 08:00 em Brasília quando UTC-3.
-- Atenção: ajuste se quiser outro horário.
select cron.schedule(
  'finplanner-alertas-diarios',
  '0 11 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='finplanner_project_url')
           || '/functions/v1/finplanner-alertas',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-Cron-Secret',(select decrypted_secret from vault.decrypted_secrets where name='finplanner_cron_secret')
    ),
    body := '{"mode":"scheduled"}'::jsonb
  );
  $$
);
