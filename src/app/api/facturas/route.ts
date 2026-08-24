import { NextRequest, NextResponse } from "next/server";
import {
  timbrarFactura,
  type NuevaFacturaInput,
  type TipoComprobante,
} from "@/lib/timbrado";

const TIPOS_SOPORTADOS: TipoComprobante[] = ["I", "E", "P"];

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | (NuevaFacturaInput & { emisorToken: string })
    | null;

  // Un CFDI de Pago no manda conceptos reales desde el cliente (el filler
  // "Pago" $0 lo arma buildDatosJSONPago del lado del servidor); en cambio
  // sí necesita el bloque `pago` con al menos un documento relacionado.
  const tipoTentativo = body?.tipoDeComprobante;
  const requiereConceptos = tipoTentativo !== "P";

  if (
    !body?.emisorToken ||
    !body?.rfcEmisor ||
    (requiereConceptos && !body?.conceptos?.length) ||
    !body?.receptorRfc ||
    !body?.receptorNombre ||
    !body?.receptorRegimenFiscal ||
    !body?.receptorUsoCfdi
  ) {
    return NextResponse.json({ error: "Faltan datos de la factura" }, { status: 400 });
  }

  // El tipo llega del cliente: se valida aquí también porque JSON_CFDI40 lo
  // copia tal cual al XML y un valor raro se convierte en un rechazo del PAC
  // (con timbre consumido).
  const tipo = body.tipoDeComprobante;
  if (!tipo || !TIPOS_SOPORTADOS.includes(tipo)) {
    return NextResponse.json(
      { error: "Tipo de comprobante no soportado por esta pantalla" },
      { status: 400 }
    );
  }

  // Una nota de crédito sin CFDI relacionado es válida para el schema, pero
  // deja al receptor sin forma de amarrarla con su factura original.
  if (tipo === "E" && !body.cfdiRelacionados?.uuids?.length) {
    return NextResponse.json(
      { error: "Una nota de crédito debe relacionar al menos un CFDI" },
      { status: 400 }
    );
  }

  if (tipo === "P" && !body.pago?.doctoRelacionado?.length) {
    return NextResponse.json(
      { error: "Un complemento de pago debe decir qué factura salda" },
      { status: 400 }
    );
  }

  const resp = await timbrarFactura(body.emisorToken, { ...body, tipoDeComprobante: tipo });

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json(resp);
}
