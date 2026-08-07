-- 1. Primero crear a Eduardo y Rodrigo en Authentication > Users > Add user.
-- 2. Reemplazar los dos correos de este archivo.
-- 3. Ejecutar todo en Supabase SQL Editor.

alter table public.perfiles
  add column if not exists empresa_id uuid null references public.empresas(id) on delete set null,
  add column if not exists permisos text[] null;

do $$
declare
  v_eduardo uuid;
  v_rodrigo uuid;
  v_berlin constant uuid := '5b66d548-cf91-4262-8e65-2cfd70e9a148';
begin
  select id into v_eduardo from auth.users
  where lower(email) = lower('REEMPLAZAR_CORREO_EDUARDO');

  select id into v_rodrigo from auth.users
  where lower(email) = lower('REEMPLAZAR_CORREO_RODRIGO');

  if v_eduardo is null then
    raise exception 'No se encontró el usuario de Eduardo';
  end if;
  if v_rodrigo is null then
    raise exception 'No se encontró el usuario de Rodrigo';
  end if;

  insert into public.perfiles
    (usuario_id, nombre, rol, empresa_id, permisos)
  values
    (v_eduardo, 'Eduardo', 'cliente', v_berlin, array['dashboard','costos'])
  on conflict (usuario_id) do update set
    nombre = excluded.nombre,
    rol = excluded.rol,
    empresa_id = excluded.empresa_id,
    permisos = excluded.permisos;

  insert into public.perfiles
    (usuario_id, nombre, rol, empresa_id, permisos)
  values
    (v_rodrigo, 'Rodrigo', 'admin', null, null)
  on conflict (usuario_id) do update set
    nombre = excluded.nombre,
    rol = excluded.rol,
    empresa_id = null,
    permisos = null;
end $$;

create or replace function public.ragg_es_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where usuario_id = auth.uid() and rol = 'admin'
  );
$$;

create or replace function public.ragg_puede_ver_empresa(p_empresa uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where usuario_id = auth.uid()
      and (rol = 'admin' or empresa_id = p_empresa)
  );
$$;

grant execute on function public.ragg_es_admin() to authenticated;
grant execute on function public.ragg_puede_ver_empresa(uuid) to authenticated;

create or replace function public.ragg_puede_editar_costos(p_empresa uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where usuario_id = auth.uid()
      and (
        rol = 'admin'
        or (
          empresa_id = p_empresa
          and 'costos' = any(coalesce(permisos, array[]::text[]))
        )
      )
  );
$$;

grant execute on function public.ragg_puede_editar_costos(uuid) to authenticated;

-- Sustituimos la política provisoria de Berlín por lectura por empresa
-- y escritura exclusiva de administradores.
drop policy if exists berlin_ventas_empresa_visible on public.berlin_ventas;
drop policy if exists berlin_ventas_lectura on public.berlin_ventas;
drop policy if exists berlin_ventas_admin on public.berlin_ventas;
create policy berlin_ventas_lectura on public.berlin_ventas
  for select to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id));
create policy berlin_ventas_admin on public.berlin_ventas
  for all to authenticated
  using (public.ragg_es_admin())
  with check (public.ragg_es_admin());

drop policy if exists berlin_config_empresa_visible on public.berlin_producto_config;
drop policy if exists berlin_config_lectura on public.berlin_producto_config;
drop policy if exists berlin_config_admin on public.berlin_producto_config;
create policy berlin_config_lectura on public.berlin_producto_config
  for select to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id));
create policy berlin_config_admin on public.berlin_producto_config
  for all to authenticated
  using (public.ragg_es_admin())
  with check (public.ragg_es_admin());

-- Las empresas visibles se restringen por perfil. Esta política se crea como
-- restrictiva para complementar las políticas existentes del proyecto.
alter table public.empresas enable row level security;
drop policy if exists ragg_empresas_visibles on public.empresas;
drop policy if exists ragg_empresas_lectura_base on public.empresas;
create policy ragg_empresas_lectura_base on public.empresas
  for select to authenticated
  using (public.ragg_puede_ver_empresa(id));
create policy ragg_empresas_visibles on public.empresas
  as restrictive for select to authenticated
  using (public.ragg_puede_ver_empresa(id));

-- El selector del dashboard obtiene sus opciones desde periodos y sucursales.
-- El cliente solo puede leer los registros pertenecientes a su empresa.
alter table public.periodos enable row level security;
drop policy if exists ragg_periodos_lectura_base on public.periodos;
drop policy if exists ragg_periodos_visibles on public.periodos;
create policy ragg_periodos_lectura_base on public.periodos
  for select to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id));
create policy ragg_periodos_visibles on public.periodos
  as restrictive for select to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id));

alter table public.sucursales enable row level security;
drop policy if exists ragg_sucursales_lectura_base on public.sucursales;
drop policy if exists ragg_sucursales_visibles on public.sucursales;
create policy ragg_sucursales_lectura_base on public.sucursales
  for select to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id));
create policy ragg_sucursales_visibles on public.sucursales
  as restrictive for select to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id));

-- El cliente puede consultar los costos de su empresa, pero solo un
-- administrador puede modificarlos desde la API.
alter table public.producto_costo_manual enable row level security;
drop policy if exists ragg_costos_visibles on public.producto_costo_manual;
drop policy if exists ragg_costos_lectura_base on public.producto_costo_manual;
drop policy if exists ragg_costos_admin_base on public.producto_costo_manual;
drop policy if exists ragg_costos_insert_admin on public.producto_costo_manual;
drop policy if exists ragg_costos_update_admin on public.producto_costo_manual;
drop policy if exists ragg_costos_update_autorizado on public.producto_costo_manual;
drop policy if exists ragg_costos_update_base on public.producto_costo_manual;
drop policy if exists ragg_costos_delete_admin on public.producto_costo_manual;
create policy ragg_costos_lectura_base on public.producto_costo_manual
  for select to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id));
create policy ragg_costos_visibles on public.producto_costo_manual
  as restrictive for select to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id));
create policy ragg_costos_insert_admin on public.producto_costo_manual
  as restrictive for insert to authenticated
  with check (public.ragg_es_admin());
create policy ragg_costos_update_base on public.producto_costo_manual
  for update to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id))
  with check (public.ragg_puede_ver_empresa(empresa_id));
create policy ragg_costos_update_autorizado on public.producto_costo_manual
  as restrictive for update to authenticated
  using (public.ragg_puede_editar_costos(empresa_id))
  with check (public.ragg_puede_editar_costos(empresa_id));
create policy ragg_costos_delete_admin on public.producto_costo_manual
  as restrictive for delete to authenticated
  using (public.ragg_es_admin());
create policy ragg_costos_admin_base on public.producto_costo_manual
  for all to authenticated
  using (public.ragg_es_admin()) with check (public.ragg_es_admin());
