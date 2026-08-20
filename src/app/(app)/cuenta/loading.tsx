import { EsqueletoEncabezado, EsqueletoTarjeta, PantallaEsqueleto } from "@/components/carga/Esqueleto";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <PantallaEsqueleto mensaje="Cargando tu cuenta…">
        <EsqueletoEncabezado />
        <EsqueletoTarjeta lineas={2} />
        <EsqueletoTarjeta lineas={4} />
        <EsqueletoTarjeta lineas={3} />
        <EsqueletoTarjeta lineas={3} />
      </PantallaEsqueleto>
    </div>
  );
}
