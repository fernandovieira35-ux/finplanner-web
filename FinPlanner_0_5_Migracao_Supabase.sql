
-- ============================================================
-- FinPlanner Web 0.5
-- Migração sobre a estrutura 0.1/0.4 existente
-- PostgreSQL / Supabase
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Ajustes em lançamentos
-- ------------------------------------------------------------
alter table public.lancamentos
  add column if not exists competencia date,
  add column if not exists codigo_barras varchar(200),
  add column if not exists linha_digitavel varchar(200),
  add column if not exists origem varchar(30) default 'MANUAL',
  add column if not exists origem_id uuid,
  add column if not exists valor_confirmado boolean not null default true;

update public.lancamentos
set competencia = date_trunc('month', data_vencimento)::date
where competencia is null;

create index if not exists idx_lancamentos_usuario_competencia
  on public.lancamentos(usuario_id, competencia);

-- ------------------------------------------------------------
-- Receitas recorrentes (ex.: salário)
-- ------------------------------------------------------------
create table if not exists public.receitas_recorrentes (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    descricao varchar(150) not null,
    valor numeric(15,2) not null check (valor >= 0),
    dia_recebimento integer not null check (dia_recebimento between 1 and 31),
    data_inicio date not null,
    data_fim date,
    ativo boolean not null default true,
    categoria_id uuid references public.categorias(id) on delete set null,
    conta_id uuid references public.contas(id) on delete set null,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz,
    constraint chk_receita_rec_datas check (data_fim is null or data_fim >= data_inicio)
);

-- ------------------------------------------------------------
-- Contas recorrentes
-- FIXA      -> valor não muda
-- VARIAVEL  -> valor previsto pode ser alterado a cada mês
-- ------------------------------------------------------------
create table if not exists public.contas_recorrentes (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    descricao varchar(150) not null,
    tipo_valor varchar(10) not null check (tipo_valor in ('FIXA','VARIAVEL')),
    valor_padrao numeric(15,2),
    dia_vencimento integer not null check (dia_vencimento between 1 and 31),
    categoria_id uuid references public.categorias(id) on delete set null,
    conta_id uuid references public.contas(id) on delete set null,
    codigo_barras_padrao varchar(200),
    linha_digitavel_padrao varchar(200),
    data_inicio date not null,
    data_fim date,
    ativo boolean not null default true,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz,
    constraint chk_conta_rec_datas check (data_fim is null or data_fim >= data_inicio)
);

-- ------------------------------------------------------------
-- Financiamentos / parcelamentos fixos
-- ------------------------------------------------------------
create table if not exists public.financiamentos (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    descricao varchar(150) not null,
    valor_parcela numeric(15,2) not null check (valor_parcela >= 0),
    quantidade_parcelas integer not null check (quantidade_parcelas > 0),
    primeira_competencia date not null,
    dia_vencimento integer not null check (dia_vencimento between 1 and 31),
    categoria_id uuid references public.categorias(id) on delete set null,
    conta_id uuid references public.contas(id) on delete set null,
    ativo boolean not null default true,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz
);

create table if not exists public.parcelas_financiamento (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    financiamento_id uuid not null references public.financiamentos(id) on delete cascade,
    numero_parcela integer not null,
    competencia date not null,
    data_vencimento date not null,
    valor numeric(15,2) not null check (valor >= 0),
    lancamento_id uuid references public.lancamentos(id) on delete set null,
    criado_em timestamptz not null default now(),
    unique(financiamento_id, numero_parcela)
);

-- ------------------------------------------------------------
-- Cartões
-- ------------------------------------------------------------
create table if not exists public.cartoes (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    descricao varchar(100) not null,
    limite numeric(15,2),
    dia_fechamento integer not null check (dia_fechamento between 1 and 31),
    dia_vencimento integer not null check (dia_vencimento between 1 and 31),
    conta_pagamento_id uuid references public.contas(id) on delete set null,
    ativo boolean not null default true,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz
);

create table if not exists public.compras_cartao (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    cartao_id uuid not null references public.cartoes(id) on delete cascade,
    descricao varchar(150) not null,
    valor_total numeric(15,2) not null check (valor_total >= 0),
    quantidade_parcelas integer not null default 1 check (quantidade_parcelas > 0),
    data_compra date not null,
    primeira_competencia date not null,
    categoria_id uuid references public.categorias(id) on delete set null,
    criado_em timestamptz not null default now()
);

create table if not exists public.parcelas_cartao (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    compra_id uuid not null references public.compras_cartao(id) on delete cascade,
    cartao_id uuid not null references public.cartoes(id) on delete cascade,
    numero_parcela integer not null,
    competencia date not null,
    valor numeric(15,2) not null check (valor >= 0),
    criado_em timestamptz not null default now(),
    unique(compra_id, numero_parcela)
);

create table if not exists public.faturas_cartao (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    cartao_id uuid not null references public.cartoes(id) on delete cascade,
    competencia date not null,
    data_vencimento date not null,
    valor_total numeric(15,2) not null default 0,
    status varchar(20) not null default 'PENDENTE'
      check (status in ('PENDENTE','PAGO','CANCELADO')),
    lancamento_id uuid references public.lancamentos(id) on delete set null,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz,
    unique(cartao_id, competencia)
);

-- ------------------------------------------------------------
-- Notificações internas
-- ------------------------------------------------------------
create table if not exists public.notificacoes (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    lancamento_id uuid references public.lancamentos(id) on delete cascade,
    tipo varchar(30) not null default 'VENCIMENTO',
    titulo varchar(150) not null,
    mensagem text not null,
    lida boolean not null default false,
    criada_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Preferências de alerta
-- ------------------------------------------------------------
create table if not exists public.preferencias_alerta (
    usuario_id uuid primary key references auth.users(id) on delete cascade,
    alerta_interno boolean not null default true,
    alerta_email boolean not null default false,
    email_destino varchar(200),
    alerta_whatsapp boolean not null default false,
    whatsapp_numero varchar(30),
    dias_antes integer[] not null default array[5,2,0],
    atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Função utilitária para ajustar o dia ao último dia do mês
-- ------------------------------------------------------------
create or replace function public.fn_data_no_mes(p_competencia date, p_dia integer)
returns date
language plpgsql
immutable
as $$
declare
  v_ultimo integer;
begin
  v_ultimo := extract(day from (date_trunc('month', p_competencia) + interval '1 month - 1 day'))::integer;
  return make_date(
    extract(year from p_competencia)::integer,
    extract(month from p_competencia)::integer,
    least(p_dia, v_ultimo)
  );
end;
$$;

-- ------------------------------------------------------------
-- Geração mensal: salário + contas recorrentes
-- Pode ser chamada pelo sistema no início de cada mês
-- ------------------------------------------------------------
create or replace function public.fn_gerar_competencia(p_competencia date)
returns void
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  insert into public.lancamentos(
    usuario_id, categoria_id, conta_id, descricao, tipo,
    valor_original, data_lancamento, data_vencimento, competencia,
    status, recorrente, parcelado, origem, origem_id, valor_confirmado
  )
  select
    r.usuario_id, r.categoria_id, r.conta_id, r.descricao, 'R',
    r.valor, current_date, public.fn_data_no_mes(p_competencia, r.dia_recebimento),
    date_trunc('month', p_competencia)::date,
    'PENDENTE', true, false, 'RECEITA_RECORRENTE', r.id, true
  from public.receitas_recorrentes r
  where r.usuario_id = v_uid
    and r.ativo
    and r.data_inicio <= (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date
    and (r.data_fim is null or r.data_fim >= date_trunc('month', p_competencia)::date)
    and not exists (
      select 1 from public.lancamentos l
      where l.usuario_id = v_uid
        and l.origem = 'RECEITA_RECORRENTE'
        and l.origem_id = r.id
        and l.competencia = date_trunc('month', p_competencia)::date
    );

  insert into public.lancamentos(
    usuario_id, categoria_id, conta_id, descricao, tipo,
    valor_original, data_lancamento, data_vencimento, competencia,
    status, recorrente, parcelado, origem, origem_id, valor_confirmado,
    codigo_barras, linha_digitavel
  )
  select
    c.usuario_id, c.categoria_id, c.conta_id, c.descricao, 'D',
    coalesce(c.valor_padrao, 0), current_date,
    public.fn_data_no_mes(p_competencia, c.dia_vencimento),
    date_trunc('month', p_competencia)::date,
    'PENDENTE', true, false, 'CONTA_RECORRENTE', c.id,
    case when c.tipo_valor = 'FIXA' then true else false end,
    c.codigo_barras_padrao, c.linha_digitavel_padrao
  from public.contas_recorrentes c
  where c.usuario_id = v_uid
    and c.ativo
    and c.data_inicio <= (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date
    and (c.data_fim is null or c.data_fim >= date_trunc('month', p_competencia)::date)
    and not exists (
      select 1 from public.lancamentos l
      where l.usuario_id = v_uid
        and l.origem = 'CONTA_RECORRENTE'
        and l.origem_id = c.id
        and l.competencia = date_trunc('month', p_competencia)::date
    );
end;
$$;

grant execute on function public.fn_gerar_competencia(date) to authenticated;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.receitas_recorrentes enable row level security;
alter table public.contas_recorrentes enable row level security;
alter table public.financiamentos enable row level security;
alter table public.parcelas_financiamento enable row level security;
alter table public.cartoes enable row level security;
alter table public.compras_cartao enable row level security;
alter table public.parcelas_cartao enable row level security;
alter table public.faturas_cartao enable row level security;
alter table public.notificacoes enable row level security;
alter table public.preferencias_alerta enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'receitas_recorrentes','contas_recorrentes','financiamentos',
    'parcelas_financiamento','cartoes','compras_cartao',
    'parcelas_cartao','faturas_cartao','notificacoes'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_insert', t);
    execute format('drop policy if exists %I on public.%I', t||'_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = usuario_id)',
      t||'_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = usuario_id)',
      t||'_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id)',
      t||'_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = usuario_id)',
      t||'_delete', t
    );
  end loop;
end $$;

drop policy if exists preferencias_alerta_select on public.preferencias_alerta;
drop policy if exists preferencias_alerta_insert on public.preferencias_alerta;
drop policy if exists preferencias_alerta_update on public.preferencias_alerta;

create policy preferencias_alerta_select
on public.preferencias_alerta for select
to authenticated
using ((select auth.uid()) = usuario_id);

create policy preferencias_alerta_insert
on public.preferencias_alerta for insert
to authenticated
with check ((select auth.uid()) = usuario_id);

create policy preferencias_alerta_update
on public.preferencias_alerta for update
to authenticated
using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);

grant select, insert, update, delete
on public.receitas_recorrentes,
   public.contas_recorrentes,
   public.financiamentos,
   public.parcelas_financiamento,
   public.cartoes,
   public.compras_cartao,
   public.parcelas_cartao,
   public.faturas_cartao,
   public.notificacoes
to authenticated;

grant select, insert, update
on public.preferencias_alerta
to authenticated;

commit;
