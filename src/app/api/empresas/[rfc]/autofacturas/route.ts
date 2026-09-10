import { NextRequest, NextResponse } from "next/server";
import { crearAutofactura, getAutofacturas, type NuevaAutofacturaInput } from "@/lib/autofacturasEmisor";
import { problemasDeConceptos } from "@/lib/facturaNueva";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const autofacturas = await getAutofacturas(decodeURIComponent(rfc));
  return NextResponse.json({ autofacturas });
}

/** Crea una autofactura desde el app: conceptos + datos de la venta -> QR y enlace. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as Partial<NuevaAutofacturaInput> | null;

  if (!body?.serie || !body.formaPago || !body.metodoPago || !Array.isArray(body.conceptos)) {
    return NextResponse.json({ error: "Faltan datos de la venta" }, { status: 400 });
  }
  // Misma revisión que el asistente de nueva factura: lo que el SAT va a
  // rechazar no debe llegar a guardarse como venta pendiente.
  const problemas = problemasDeConceptos(body.conceptos);
  if (problemas.length > 0) {
    return NextResponse.json({ error: problemas[0].mensaje, problemas }, { status: 400 });
  }
  const expira = body.expiraEnDias ? Number(body.expiraEnDias) : undefined;
  if (expira !== undefined && !(expira >= 1 && expira <= 365)) {
    return NextResponse.json({ error: "La vigencia debe ser de 1 a 365 días" }, { status: 400 });
  }

  const resp = await crearAutofactura(decodeURIComponent(rfc), {
    serie: body.serie,
    formaPago: body.formaPago,
    metodoPago: body.metodoPago,
    conceptos: body.conceptos,
    referencia: body.referencia?.trim() || undefined,
    emailReceptor: body.emailReceptor?.trim().toLowerCase() || undefined,
    expiraEnDias: expira,
  });
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json(resp);
}
