
-- ============================================================
-- FinPlanner Web 1.1 - Login e Alertas
-- Execute uma única vez após a migração 0.5
-- ============================================================

begin;

alter table public.preferencias_alerta
  add column if not exists hora_alerta time not null default '08:00',
  add column if not exists ultimo_teste_email timestamptz,
  add column if not exists ultimo_teste_whatsapp timestamptz;

create table if not exists public.alertas_enviados (
    id bigint generated always as identity primary key,
    usuario_id uuid not null references auth.users(id) on delete cascade,
    lancamento_id uuid references public.lancamentos(id) on delete cascade,
    canal varchar(20) not null check (canal in ('INTERNO','EMAIL','WHATSAPP')),
    referencia date not null default current_date,
    dias_antes integer,
    sucesso boolean not null default true,
    resposta text,
    criado_em timestamptz not null default now()
);

alter table public.alertas_enviados enable row level security;

drop policy if exists alertas_enviados_select on public.alertas_enviados;
create policy alertas_enviados_select
on public.alertas_enviados for select
to authenticated
using ((select auth.uid()) = usuario_id);

grant select on public.alertas_enviados to authenticated;

create unique index if not exists uq_alerta_envio_dia
on public.alertas_enviados(usuario_id, lancamento_id, canal, referencia, dias_antes)
where sucesso = true;

commit;
