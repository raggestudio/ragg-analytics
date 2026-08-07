-- Ejecutar una sola vez en Supabase SQL Editor.
-- Permite editar costos únicamente a administradores y a clientes que tengan
-- el permiso "costos" para la empresa asignada en su perfil.

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

alter table public.producto_costo_manual enable row level security;

drop policy if exists ragg_costos_update_admin
  on public.producto_costo_manual;
drop policy if exists ragg_costos_update_autorizado
  on public.producto_costo_manual;
drop policy if exists ragg_costos_update_base
  on public.producto_costo_manual;

create policy ragg_costos_update_base
  on public.producto_costo_manual
  for update
  to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id))
  with check (public.ragg_puede_ver_empresa(empresa_id));

create policy ragg_costos_update_autorizado
  on public.producto_costo_manual
  as restrictive
  for update
  to authenticated
  using (public.ragg_puede_editar_costos(empresa_id))
  with check (public.ragg_puede_editar_costos(empresa_id));
