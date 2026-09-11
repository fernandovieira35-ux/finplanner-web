-- ============================================================
-- FinPlanner Web 1.7 - Consolidação
-- Execute após as migrações anteriores. Usa IF NOT EXISTS.
-- ============================================================
begin;

alter table public.preferencias_alerta
  add column if not exists inicio_disparos timestamptz,
  add column if not exists fim_disparos timestamptz,
  add column if not exists hora_alerta time not null default '08:00';

alter table public.pagamentos
  add column if not exists conta_pagamento_id uuid
    references public.contas(id) on delete set null;

create index if not exists idx_pagamentos_conta_pagamento
  on public.pagamentos(conta_pagamento_id);

commit;
