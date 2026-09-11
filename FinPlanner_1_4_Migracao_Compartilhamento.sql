-- ============================================================
-- FinPlanner Web 1.4 - Financeiro compartilhado
-- Execute uma única vez no Supabase.
-- ============================================================
begin;

create table if not exists public.grupos_financeiros (
  id uuid primary key default gen_random_uuid(),
  nome varchar(120) not null,
  proprietario_id uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table if not exists public.grupo_membros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_financeiros(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  papel varchar(20) not null default 'MEMBRO' check (papel in ('PROPRIETARIO','ADMIN','MEMBRO')),
  pode_visualizar boolean not null default true,
  pode_editar boolean not null default true,
  pode_excluir boolean not null default false,
  criado_em timestamptz not null default now(),
  unique(grupo_id, usuario_id)
);

alter table public.contas add column if not exists grupo_id uuid references public.grupos_financeiros(id) on delete set null;
alter table public.categorias add column if not exists grupo_id uuid references public.grupos_financeiros(id) on delete set null;
alter table public.lancamentos add column if not exists grupo_id uuid references public.grupos_financeiros(id) on delete set null;
alter table public.pagamentos add column if not exists grupo_id uuid references public.grupos_financeiros(id) on delete set null;
alter table public.receitas_recorrentes add column if not exists grupo_id uuid references public.grupos_financeiros(id) on delete set null;
alter table public.contas_recorrentes add column if not exists grupo_id uuid references public.grupos_financeiros(id) on delete set null;
alter table public.cartoes add column if not exists grupo_id uuid references public.grupos_financeiros(id) on delete set null;
alter table public.compras_cartao add column if not exists grupo_id uuid references public.grupos_financeiros(id) on delete set null;

insert into public.grupos_financeiros(nome, proprietario_id)
select 'Financeiro Principal', p.id
from public.perfis p
where p.administrador = true
  and not exists (
    select 1 from public.grupos_financeiros g where g.proprietario_id = p.id
  );

insert into public.grupo_membros(grupo_id,usuario_id,papel,pode_visualizar,pode_editar,pode_excluir)
select g.id,g.proprietario_id,'PROPRIETARIO',true,true,true
from public.grupos_financeiros g
on conflict(grupo_id,usuario_id) do nothing;

update public.contas t set grupo_id=g.id from public.grupos_financeiros g where t.usuario_id=g.proprietario_id and t.grupo_id is null;
update public.categorias t set grupo_id=g.id from public.grupos_financeiros g where t.usuario_id=g.proprietario_id and t.grupo_id is null;
update public.lancamentos t set grupo_id=g.id from public.grupos_financeiros g where t.usuario_id=g.proprietario_id and t.grupo_id is null;
update public.pagamentos t set grupo_id=g.id from public.grupos_financeiros g where t.usuario_id=g.proprietario_id and t.grupo_id is null;
update public.receitas_recorrentes t set grupo_id=g.id from public.grupos_financeiros g where t.usuario_id=g.proprietario_id and t.grupo_id is null;
update public.contas_recorrentes t set grupo_id=g.id from public.grupos_financeiros g where t.usuario_id=g.proprietario_id and t.grupo_id is null;
update public.cartoes t set grupo_id=g.id from public.grupos_financeiros g where t.usuario_id=g.proprietario_id and t.grupo_id is null;
update public.compras_cartao t set grupo_id=g.id from public.grupos_financeiros g where t.usuario_id=g.proprietario_id and t.grupo_id is null;

create or replace function public.fn_pode_ver_grupo(p_grupo uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.grupo_membros gm
    where gm.grupo_id=p_grupo and gm.usuario_id=auth.uid() and gm.pode_visualizar
  );
$$;

create or replace function public.fn_pode_editar_grupo(p_grupo uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.grupo_membros gm
    where gm.grupo_id=p_grupo and gm.usuario_id=auth.uid() and gm.pode_editar
  );
$$;

create or replace function public.fn_pode_excluir_grupo(p_grupo uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.grupo_membros gm
    where gm.grupo_id=p_grupo and gm.usuario_id=auth.uid() and gm.pode_excluir
  );
$$;

grant execute on function public.fn_pode_ver_grupo(uuid) to authenticated;
grant execute on function public.fn_pode_editar_grupo(uuid) to authenticated;
grant execute on function public.fn_pode_excluir_grupo(uuid) to authenticated;

alter table public.grupos_financeiros enable row level security;
alter table public.grupo_membros enable row level security;

drop policy if exists grupos_select on public.grupos_financeiros;
create policy grupos_select on public.grupos_financeiros
for select to authenticated using (public.fn_pode_ver_grupo(id));

drop policy if exists grupo_membros_select on public.grupo_membros;
create policy grupo_membros_select on public.grupo_membros
for select to authenticated
using (usuario_id=auth.uid() or public.fn_pode_ver_grupo(grupo_id));

grant select on public.grupos_financeiros, public.grupo_membros to authenticated;

commit;
