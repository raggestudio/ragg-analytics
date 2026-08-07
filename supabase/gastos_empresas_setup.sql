-- Módulo de gastos mensuales para todas las empresas.
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
  origen text not null default 'manual',
  referencia text null,
  created_by uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gastos_empresa add column if not exists origen text not null default 'manual';
alter table public.gastos_empresa add column if not exists referencia text null;

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

create or replace function public.reemplazar_salarios_gastos(
  p_empresa_id uuid,
  p_periodo_id uuid,
  p_filas jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cantidad integer;
begin
  if not public.ragg_es_admin() then
    raise exception 'Solo un administrador puede importar salarios';
  end if;

  if not exists (
    select 1 from public.periodos
    where id = p_periodo_id and empresa_id = p_empresa_id
  ) then
    raise exception 'El período no pertenece a la empresa seleccionada';
  end if;

  delete from public.gastos_empresa
  where empresa_id = p_empresa_id
    and periodo_id = p_periodo_id
    and origen = 'sueldos_csv';

  insert into public.gastos_empresa (
    empresa_id, periodo_id, categoria, detalle, monto,
    observaciones, origen, referencia, created_by
  )
  select
    p_empresa_id,
    p_periodo_id,
    'Salarios y jornales',
    x.nombre,
    x.liquido,
    concat_ws(' · ',
      nullif('Liquidación: ' || x.liquidacion, 'Liquidación: '),
      nullif('CI: ' || x.ci, 'CI: '),
      'Haberes: ' || x.haberes,
      'Descuentos: ' || x.descuentos,
      'Líquido: ' || x.liquido
    ),
    'sueldos_csv',
    x.ci,
    auth.uid()
  from jsonb_to_recordset(p_filas) as x(
    periodo_anio integer,
    periodo_mes integer,
    liquidacion text,
    nombre text,
    ci text,
    haberes numeric,
    descuentos numeric,
    liquido numeric,
    costo numeric
  )
  where x.liquido > 0;

  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;

grant execute on function public.reemplazar_salarios_gastos(uuid, uuid, jsonb) to authenticated;
