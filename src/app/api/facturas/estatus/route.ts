import { NextRequest, NextResponse } from "next/server";
import { consultarEstatusSat } from "@/lib/facturas";
import { getEmisor } from "@/lib/emisores";

type Item = {
  uuid?: string;
  rfcEmisor?: string;
  rfcReceptor?: string;
  total?: string;
};

/**
 * Cada consulta es una llamada SOAP al SAT firmada con el CSD del emisor:
 * tarda del orden de un segundo y se procesan en serie. El tope existe para
 * que una tanda no reviente el timeout del servidor — el cliente parte la
 * lista en grupos de este tamaño y va mostrando el avance.
 */
const MAX_POR_TANDA = 8;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { items?: Item[] } | null;
  const items = body?.items ?? [];

  if (items.length === 0) {
    return NextResponse.json({ error: "No se recibió ninguna factura" }, { status: 400 });
  }
  if (items.length > MAX_POR_TANDA) {
    return NextResponse.json(
      { error: `Máximo ${MAX_POR_TANDA} facturas por llamada` },
      { status: 400 }
    );
  }

  // El token del emisor se resuelve una vez por RFC, no una vez por factura:
  // una tanda suele venir toda del mismo emisor.
  const tokens = new Map<string, string | null>();
  async function tokenDe(rfc: string) {
    if (!tokens.has(rfc)) {
      const emisor = await getEmisor(rfc);
      tokens.set(rfc, emisor?.Token ?? null);
    }
    return tokens.get(rfc) ?? null;
  }

  const resultados = [];

  for (const item of items) {
    if (!item.uuid || !item.rfcEmisor || !item.rfcReceptor) {
      resultados.push({ uuid: item.uuid ?? "", ok: false, error: "Datos incompletos" });
      continue;
    }

    const emisorToken = await tokenDe(item.rfcEmisor);
    if (!emisorToken) {
      resultados.push({
        uuid: item.uuid,
        ok: false,
        error: "El emisor no existe o no te pertenece",
      });
      continue;
    }

    // Una factura con datos raros (CSD roto, cert faltante en disco, etc.)
    // puede hacer que el PHP legacy devuelva algo que no es JSON valido -
    // callLegacyPhpApi lo convierte en una excepcion. Sin este try/catch,
    // esa unica factura tumbaba toda la tanda en vez de solo reportarse
    // como error en su fila (lo que pide el punto 4 de "Que debes
    // verificar" en REFACTOR-FACTURAS.md).
    try {
      const resp = await consultarEstatusSat({
        emisorToken,
        rfcEmisor: item.rfcEmisor,
        rfcReceptor: item.rfcReceptor,
        uuid: item.uuid,
        total: item.total ?? "0",
      });

      if (resp.Error !== "0") {
        resultados.push({ uuid: item.uuid, ok: false, error: resp.DescripError });
        continue;
      }

      resultados.push({
        uuid: item.uuid,
        ok: true,
        estado: resp.Estado,
        esCancelable: resp.EsCancelable,
        estatusCancelacion: resp.EstatusCancelacion,
        codigoEstatus: resp.CodigoEstatus,
      });
    } catch (e) {
      resultados.push({
        uuid: item.uuid,
        ok: false,
        error: e instanceof Error ? e.message : "No se pudo consultar el SAT",
      });
    }
  }

  return NextResponse.json({ resultados, maxPorTanda: MAX_POR_TANDA });
}
