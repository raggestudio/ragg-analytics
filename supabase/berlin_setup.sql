-- Ejecutar una sola vez en Supabase SQL Editor.
-- Berlín queda configurado como restaurante y con una sucursal principal.
update public.empresas
set tipo_negocio = 'restaurante'
where id = '5b66d548-cf91-4262-8e65-2cfd70e9a148';

insert into public.sucursales (empresa_id, nombre, activa)
select '5b66d548-cf91-4262-8e65-2cfd70e9a148', 'Berlín', true
where not exists (
  select 1 from public.sucursales
  where empresa_id = '5b66d548-cf91-4262-8e65-2cfd70e9a148'
    and lower(nombre) = 'berlín'
);

insert into public.periodos (empresa_id, anio, mes, nombre, estado)
select '5b66d548-cf91-4262-8e65-2cfd70e9a148', v.anio, v.mes, v.nombre, 'abierto'
from (values (2026, 6, 'Junio 2026'), (2026, 7, 'Julio 2026')) v(anio, mes, nombre)
where not exists (
  select 1 from public.periodos p
  where p.empresa_id = '5b66d548-cf91-4262-8e65-2cfd70e9a148'
    and p.anio = v.anio and p.mes = v.mes
);

create table if not exists public.berlin_ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  sucursal_id uuid null references public.sucursales(id) on delete set null,
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  periodo_anio integer not null,
  periodo_mes integer not null,
  fuente text not null check (fuente in ('infoclub','historico_no','ocr_salon','ocr_delivery','ocr_takeaway')),
  documento text not null,
  fecha timestamptz null,
  modalidad text not null check (modalidad in ('salon','delivery','take_away')),
  nombre_producto text not null,
  nombre_normalizado text not null,
  cantidad numeric not null default 0,
  precio_unitario numeric not null default 0,
  venta_total numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists berlin_ventas_consulta_idx
  on public.berlin_ventas (empresa_id, periodo_id, sucursal_id, modalidad);
create index if not exists berlin_ventas_producto_idx
  on public.berlin_ventas (empresa_id, nombre_normalizado);

create table if not exists public.berlin_producto_config (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre_normalizado text not null,
  nombre_producto text not null,
  categoria text null,
  costo_manual_id uuid null references public.producto_costo_manual(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (empresa_id, nombre_normalizado)
);

alter table public.berlin_ventas enable row level security;
alter table public.berlin_producto_config enable row level security;

drop policy if exists berlin_ventas_empresa_visible on public.berlin_ventas;
create policy berlin_ventas_empresa_visible on public.berlin_ventas
for all to authenticated
using (exists (select 1 from public.empresas e where e.id = berlin_ventas.empresa_id))
with check (exists (select 1 from public.empresas e where e.id = berlin_ventas.empresa_id));

drop policy if exists berlin_config_empresa_visible on public.berlin_producto_config;
create policy berlin_config_empresa_visible on public.berlin_producto_config
for all to authenticated
using (exists (select 1 from public.empresas e where e.id = berlin_producto_config.empresa_id))
with check (exists (select 1 from public.empresas e where e.id = berlin_producto_config.empresa_id));

grant select, insert, update, delete on public.berlin_ventas to authenticated;
grant select, insert, update, delete on public.berlin_producto_config to authenticated;
