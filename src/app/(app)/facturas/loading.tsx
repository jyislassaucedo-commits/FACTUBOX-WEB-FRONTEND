import {
  Bloque,
  EsqueletoEncabezado,
  EsqueletoTabla,
  PantallaEsqueleto,
} from "@/components/carga/Esqueleto";

export default function Loading() {
  return (
    <PantallaEsqueleto mensaje="Cargando tus facturas…">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <EsqueletoEncabezado />
        <Bloque className="h-9 w-32 rounded-[10px]" />
      </div>

      {/* Barra de filtros: se dibuja porque en la pantalla real esta ahi
          arriba, y omitirla haria que la tabla saltara hacia abajo al cargar. */}
      <div className="flex flex-wrap gap-2">
        <Bloque className="h-9 w-52 rounded-[10px]" />
        <Bloque className="h-9 w-36 rounded-[10px]" />
        <Bloque className="h-9 w-36 rounded-[10px]" />
      </div>

      <EsqueletoTabla filas={8} />
    </PantallaEsqueleto>
  );
}
