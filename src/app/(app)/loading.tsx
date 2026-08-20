import {
  Bloque,
  EsqueletoEncabezado,
  EsqueletoTarjeta,
  PantallaEsqueleto,
} from "@/components/carga/Esqueleto";

/**
 * Esqueleto del tablero de inicio.
 *
 * Vive en el grupo (app), asi que ademas es el respaldo de cualquier ruta hija
 * que no traiga el suyo: una pantalla nueva nunca nace sin senal de carga.
 */
export default function Loading() {
  return (
    <PantallaEsqueleto mensaje="Cargando tu tablero…">
      <EsqueletoEncabezado />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-line bg-surface p-5">
            <Bloque className="h-2.5 w-20" />
            <Bloque className="h-7 w-28" />
            <Bloque className="h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <EsqueletoTarjeta lineas={6} />
        <EsqueletoTarjeta lineas={6} />
      </div>
    </PantallaEsqueleto>
  );
}
