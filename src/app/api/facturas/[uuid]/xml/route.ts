import { NextResponse } from "next/server";
import { getFacturaXml } from "@/lib/facturas";

/**
 * XML timbrado de una factura.
 *
 * Devuelve el base64 tal cual lo da el backend; decodificarlo y disparar la
 * descarga es trabajo del cliente (así el mismo endpoint sirve para el panel
 * de detalle y para el botón "Descargar XML" sin pedir el XML dos veces).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const resp = await getFacturaXml(decodeURIComponent(uuid));

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 404 });
  }

  return NextResponse.json({
    uuid: resp.UUID,
    version: resp.VersionCFDI,
    tipoDeComprobante: resp.TipoDeComprobante,
    fechaTimbrado: resp.FechaTimbrado,
    base64: resp.CFDI_Base64,
  });
}
