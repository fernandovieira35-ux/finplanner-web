
-- ============================================================
-- FinPlanner Web 1.2 - Administração de usuários
-- Execute uma única vez.
-- ============================================================

begin;

-- ATENÇÃO:
-- Este comando transforma em administrador o primeiro perfil criado no projeto.
-- Em um projeto novo/pessoal, normalmente será seu usuário principal.
update public.perfis
set administrador = true,
    atualizado_em = now()
where id = (
  select id
  from public.perfis
  order by criado_em
  limit 1
);

commit;
