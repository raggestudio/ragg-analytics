-- Ejecutar una vez en Supabase SQL Editor antes de publicar el frontend.
-- Permite al dashboard consultar únicamente el total de gastos autorizado,
-- sin exponer el detalle de la tabla gastos_empresa.

create or replace function public.obtener_total_gastos_dashboard(
  p_empresa_id uuid,
  p_periodo_id uuid,
  p_sucursal_id uuid default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.ragg_puede_ver_empresa(p_empresa_id) then
    raise exception 'No tenés acceso a esta empresa';
  end if;

  return coalesce((
    select sum(g.monto)
    from public.gastos_empresa g
    where g.empresa_id = p_empresa_id
      and g.periodo_id = p_periodo_id
      and (
        p_sucursal_id is null
        or g.sucursal_id = p_sucursal_id
      )
  ), 0);
end;
$$;

revoke all on function public.obtener_total_gastos_dashboard(uuid, uuid, uuid)
  from public;
grant execute on function public.obtener_total_gastos_dashboard(uuid, uuid, uuid)
  to authenticated;
