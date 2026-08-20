import {
  Bloque,
  EsqueletoEncabezado,
  EsqueletoTabla,
  PantallaEsqueleto,
} from "@/components/carga/Esqueleto";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl">
      <PantallaEsqueleto mensaje="Cargando tus emisores…">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <EsqueletoEncabezado />
          <Bloque className="h-9 w-32 rounded-[10px]" />
        </div>
        <EsqueletoTabla filas={6} />
      </PantallaEsqueleto>
    </div>
  );
}
