-- ============================================================
-- FinPlanner Web 1.5
-- Permissões de usuário, janela de alertas e banco do pagamento
-- Execute uma única vez após a migração 1.4.
-- ============================================================

begin;

-- Janela de vigência dos disparos
alter table public.preferencias_alerta
  add column if not exists inicio_disparos timestamptz,
  add column if not exists fim_disparos timestamptz;

-- Conta/Banco utilizado na baixa
alter table public.pagamentos
  add column if not exists conta_pagamento_id uuid
    references public.contas(id) on delete set null;

-- Índices
create index if not exists idx_pagamentos_conta_pagamento
  on public.pagamentos(conta_pagamento_id);

-- Garante políticas compartilhadas nas tabelas principais.
-- As policies são somadas (OR) às políticas existentes.
do $$
declare
  t text;
begin
  foreach t in array array[
    'contas','categorias','lancamentos','pagamentos',
    'receitas_recorrentes','contas_recorrentes',
    'cartoes','compras_cartao'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t||'_grupo_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_grupo_insert', t);
    execute format('drop policy if exists %I on public.%I', t||'_grupo_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_grupo_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (grupo_id is not null and public.fn_pode_ver_grupo(grupo_id))',
      t||'_grupo_select', t
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (grupo_id is not null and public.fn_pode_editar_grupo(grupo_id))',
      t||'_grupo_insert', t
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (grupo_id is not null and public.fn_pode_editar_grupo(grupo_id)) with check (grupo_id is not null and public.fn_pode_editar_grupo(grupo_id))',
      t||'_grupo_update', t
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (grupo_id is not null and public.fn_pode_excluir_grupo(grupo_id))',
      t||'_grupo_delete', t
    );
  end loop;
end $$;

commit;
