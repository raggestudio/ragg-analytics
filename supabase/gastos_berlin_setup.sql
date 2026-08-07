-- Módulo inicial de gastos mensuales de Berlín.
-- En esta etapa únicamente los administradores pueden consultar o modificar.

create table if not exists public.gastos_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  categoria text not null,
  detalle text null,
  monto numeric(14,2) not null check (monto > 0),
  fecha date null,
  observaciones text null,
  created_by uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gastos_empresa_periodo_idx
  on public.gastos_empresa (empresa_id, periodo_id);

alter table public.gastos_empresa enable row level security;

drop policy if exists gastos_empresa_admin_select on public.gastos_empresa;
drop policy if exists gastos_empresa_admin_insert on public.gastos_empresa;
drop policy if exists gastos_empresa_admin_update on public.gastos_empresa;
drop policy if exists gastos_empresa_admin_delete on public.gastos_empresa;

create policy gastos_empresa_admin_select on public.gastos_empresa
  for select to authenticated
  using (public.ragg_es_admin());

create policy gastos_empresa_admin_insert on public.gastos_empresa
  for insert to authenticated
  with check (public.ragg_es_admin());

create policy gastos_empresa_admin_update on public.gastos_empresa
  for update to authenticated
  using (public.ragg_es_admin())
  with check (public.ragg_es_admin());

create policy gastos_empresa_admin_delete on public.gastos_empresa
  for delete to authenticated
  using (public.ragg_es_admin());
