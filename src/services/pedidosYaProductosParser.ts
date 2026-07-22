import * as XLSX from "xlsx";

export type ProductoResumenPedidosYa = {
  codigo_producto: string | null;
  nombre_producto: string;
  categoria: string | null;
  cantidad: number;
  ventas: number;
};

function normalizarClave(valor: unknown) {
  return String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numero(valor: unknown) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  let texto = String(valor ?? "").trim();
  if (!texto) return 0;

  texto = texto.replace(/\s/g, "").replace(/\$/g, "");

  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  const resultado = Number(texto);
  return Number.isFinite(resultado) ? resultado : 0;
}

function valorFila(
  fila: Record<string, unknown>,
  variantes: string[]
): unknown {
  const entradas = new Map(
    Object.entries(fila).map(([clave, valor]) => [
      normalizarClave(clave),
      valor,
    ])
  );

  for (const variante of variantes) {
    const clave = normalizarClave(variante);
    if (entradas.has(clave)) return entradas.get(clave);
  }

  return undefined;
}

export async function leerExcelProductosPedidosYa(
  archivo: File
): Promise<ProductoResumenPedidosYa[]> {
  const buffer = await archivo.arrayBuffer();
  const libro = XLSX.read(buffer, { type: "array" });
  const primeraHoja = libro.Sheets[libro.SheetNames[0]];

  if (!primeraHoja) {
    throw new Error("El Excel de PedidosYa no contiene hojas.");
  }

  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(primeraHoja, {
    defval: "",
    raw: false,
  });

  const productos = filas
    .map((fila) => {
      const nombre = String(
        valorFila(fila, [
          "Producto",
          "Nombre del producto",
          "ArtÃ­culo",
          "Articulo",
          "Item",
        ]) ?? ""
      ).trim();

      const codigo = String(
        valorFila(fila, [
          "CÃ³digo",
          "Codigo",
          "CÃ³digo producto",
          "Codigo producto",
          "SKU",
          "ID producto",
        ]) ?? ""
      ).trim();

      const categoria = String(
        valorFila(fila, ["CategorÃ­a", "Categoria", "Rubro"]) ?? ""
      ).trim();

      return {
        codigo_producto: codigo || null,
        nombre_producto: nombre,
        categoria: categoria || null,
        cantidad: numero(
          valorFila(fila, [
            "Cantidad",
            "Unidades",
            "Ventas unidades",
            "Total",
          ])
        ),
        ventas: numero(
          valorFila(fila, [
            "Ventas",
            "Venta",
            "Importe",
            "Ventas totales",
          ])
        ),
      };
    })
    .filter(
      (producto) =>
        producto.nombre_producto &&
        (producto.cantidad !== 0 || producto.ventas !== 0)
    );

  if (productos.length === 0) {
    throw new Error(
      "No se detectaron productos. El archivo debe incluir columnas Producto, Total y Ventas."
    );
  }

  return productos;
}