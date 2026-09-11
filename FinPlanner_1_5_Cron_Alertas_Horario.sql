-- FinPlanner 1.5 - Agendamento de alertas
-- Após publicar a Edge Function e configurar os Secrets, execute conforme necessidade.
-- O exemplo abaixo executa de hora em hora. A própria função respeita inicio_disparos/fim_disparos.

-- Se já existir o job antigo, remova pelo nome no painel Cron ou via cron.unschedule.
-- Exemplo:
-- select cron.unschedule('finplanner-alertas-diarios');

select cron.schedule(
  'finplanner-alertas-horarios',
  '0 * * * *',
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
