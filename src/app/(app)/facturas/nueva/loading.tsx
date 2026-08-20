import { Bloque, EsqueletoTarjeta, PantallaEsqueleto } from "@/components/carga/Esqueleto";

export default function Loading() {
  return (
    <PantallaEsqueleto mensaje="Preparando el asistente…">
      <div className="space-y-2">
        <Bloque className="h-3 w-32" />
        <Bloque className="h-6 w-44" />
        <Bloque className="h-3.5 w-80 max-w-full" />
      </div>

      {/* Los pasos del asistente: cinco pastillas en fila. */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bloque key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      <EsqueletoTarjeta lineas={5} />
    </PantallaEsqueleto>
  );
}
