-- PASOS:
-- 1. Crear al usuario en Supabase > Authentication > Users > Add user.
-- 2. Reemplazar CORREO_DE_TU_PADRE y NOMBRE_DE_TU_PADRE más abajo.
-- 3. Ejecutar este archivo completo en Supabase SQL Editor.
--
-- El perfil nuevo copia la empresa y los permisos vigentes de Andres.
-- Por eso verá PIU exactamente con el mismo alcance y no podrá ver Duna ni Berlín.

do $$
declare
  v_usuario_padre uuid;
  v_empresa_piu uuid;
  v_permisos_andres text[];
begin
  select id
    into v_usuario_padre
  from auth.users
  where lower(email) = lower('CORREO_DE_TU_PADRE');

  if v_usuario_padre is null then
    raise exception
      'No se encontró CORREO_DE_TU_PADRE en Authentication > Users';
  end if;

  select p.empresa_id, p.permisos
    into v_empresa_piu, v_permisos_andres
  from public.perfiles p
  join public.empresas e on e.id = p.empresa_id
  where lower(e.nombre) like '%piu%'
    and lower(coalesce(p.nombre, '')) like 'andr%s'
  order by p.usuario_id
  limit 1;

  if v_empresa_piu is null then
    raise exception
      'No se encontró el perfil de Andres asignado a PIU para copiar sus permisos';
  end if;

  insert into public.perfiles
    (usuario_id, nombre, rol, empresa_id, permisos)
  values
    (
      v_usuario_padre,
      'NOMBRE_DE_TU_PADRE',
      'cliente',
      v_empresa_piu,
      v_permisos_andres
    )
  on conflict (usuario_id) do update set
    nombre = excluded.nombre,
    rol = 'cliente',
    empresa_id = excluded.empresa_id,
    permisos = excluded.permisos;
end $$;

-- Comprobación final: debe devolver una sola fila, empresa PIU y rol cliente.
select
  u.email,
  p.nombre,
  p.rol,
  e.nombre as empresa,
  p.permisos
from public.perfiles p
join auth.users u on u.id = p.usuario_id
left join public.empresas e on e.id = p.empresa_id
where lower(u.email) = lower('CORREO_DE_TU_PADRE');
