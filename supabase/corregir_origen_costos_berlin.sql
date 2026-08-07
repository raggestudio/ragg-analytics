-- Corrige los costos de Berlín que fueron importados con el origen heredado
-- del importador de Duna. Ejecutar una sola vez en Supabase SQL Editor.

update public.producto_costo_manual
set
  origen = 'excel_berlin',
  updated_at = now()
where empresa_id = '5b66d548-cf91-4262-8e65-2cfd70e9a148'
  and origen = 'excel_duna';
