-- Ejecutar una vez en Supabase SQL Editor.
-- Habilita la consulta de Gastos para los clientes de Duna, Berlín y PIU,
-- sin permitirles crear, editar, importar ni eliminar movimientos.

update public.perfiles p
set permisos = case
  when 'gastos' = any(coalesce(p.permisos, array[]::text[]))
    then p.permisos
  else array_append(coalesce(p.permisos, array[]::text[]), 'gastos')
end
from public.empresas e
where p.empresa_id = e.id
  and p.rol = 'cliente'
  and (
    lower(e.nombre) like '%duna%'
    or lower(e.nombre) like '%berlín%'
    or lower(e.nombre) like '%berlin%'
    or lower(e.nombre) like '%piu%'
  );

alter table public.gastos_empresa enable row level security;

drop policy if exists gastos_empresa_admin_select on public.gastos_empresa;
create policy gastos_empresa_admin_select on public.gastos_empresa
  for select to authenticated
  using (public.ragg_puede_ver_empresa(empresa_id));

-- Las políticas de escritura continúan exigiendo ragg_es_admin().
