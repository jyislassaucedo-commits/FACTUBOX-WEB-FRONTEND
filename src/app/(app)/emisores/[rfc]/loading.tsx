import { EsqueletoTarjeta, PantallaEsqueleto } from "@/components/carga/Esqueleto";

/**
 * Esqueleto del resumen de un emisor.
 *
 * Es la navegacion mas lenta de la aplicacion: loadEmisorContext() encadena
 * varias llamadas al PHP (emisor, series, receptores, disenos). Sin esto, el
 * navegador se queda en la pantalla anterior todo ese rato sin ninguna senal,
 * que es exactamente lo que se sentia como congelamiento.
 *
 * Reproduce la reticula de dos columnas de la pantalla real para que, al
 * llegar los datos, nada cambie de sitio.
 */
export default function Loading() {
  return (
    <PantallaEsqueleto mensaje="Cargando el emisor…">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <EsqueletoTarjeta lineas={5} />
          <EsqueletoTarjeta lineas={3} />
        </div>
        <div className="space-y-4">
          <EsqueletoTarjeta lineas={7} />
          <EsqueletoTarjeta lineas={2} />
        </div>
      </div>
    </PantallaEsqueleto>
  );
}
