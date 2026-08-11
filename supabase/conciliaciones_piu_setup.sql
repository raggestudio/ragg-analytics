-- Ejecutar una vez en Supabase SQL Editor.
-- Este registro es solamente informativo y no participa en los cálculos del dashboard.

create table if not exists public.conciliaciones_piu (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  sucursal_id uuid not null references public.sucursales(id) on delete cascade,
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  estado text not null check (estado in ('coincide', 'diferencia_menor', 'revisar')),
  venta_efectiva_pedidosya numeric not null default 0,
  venta_isatech_pedidosya numeric not null default 0,
  diferencia_ventas numeric not null default 0,
  unidades_pedidosya numeric not null default 0,
  unidades_isatech numeric not null default 0,
  diferencia_unidades numeric not null default 0,
  pedidos_contabilizados integer not null default 0,
  pedidos_cancelados integer not null default 0,
  detalle jsonb not null default '[]'::jsonb,
  actualizado_at timestamptz not null default now(),
  unique (empresa_id, sucursal_id, periodo_id)
);

alter table public.conciliaciones_piu enable row level security;

drop policy if exists "conciliaciones_piu_select" on public.conciliaciones_piu;
create policy "conciliaciones_piu_select"
on public.conciliaciones_piu for select
to authenticated
using (public.ragg_puede_ver_empresa(empresa_id));

drop policy if exists "conciliaciones_piu_admin_insert" on public.conciliaciones_piu;
create policy "conciliaciones_piu_admin_insert"
on public.conciliaciones_piu for insert
to authenticated
with check (
  exists (
    select 1 from public.perfiles p
    where p.usuario_id = auth.uid() and p.rol = 'admin'
  )
);

drop policy if exists "conciliaciones_piu_admin_update" on public.conciliaciones_piu;
create policy "conciliaciones_piu_admin_update"
on public.conciliaciones_piu for update
to authenticated
using (
  exists (
    select 1 from public.perfiles p
    where p.usuario_id = auth.uid() and p.rol = 'admin'
  )
)
with check (
  exists (
    select 1 from public.perfiles p
    where p.usuario_id = auth.uid() and p.rol = 'admin'
  )
);
