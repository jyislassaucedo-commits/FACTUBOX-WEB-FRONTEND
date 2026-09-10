import { EsqueletoTarjeta, PantallaEsqueleto } from "@/components/carga/Esqueleto";

/** La lista viene del PHP en una llamada; una tarjeta larga basta. */
export default function Loading() {
  return (
    <PantallaEsqueleto mensaje="Cargando autofacturas…">
      <EsqueletoTarjeta lineas={8} />
    </PantallaEsqueleto>
  );
}
