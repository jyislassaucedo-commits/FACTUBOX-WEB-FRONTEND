import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";
import { llamar } from "./nomina";
import type { ValidarResult } from "./timbrado";
import type { NominaManualForm, ProblemaManual, PropuestaRecibo } from "./nominaManualShared";

/* Nómina manual y prenóminas, del lado del servidor.
 *
 * Los endpoints viven en el mismo módulo PHP que la corrida (maa/mvc/Nomina),
 * así que se reusa `llamar()` de nomina.ts. Lo que es puro (el modelo, la
 * validación, los totales) está en nominaManualShared.ts para que lo puedan
 * importar los componentes cliente. */

/** Una prenómina como la lista: sin el JSON del formulario. */
export type PrenominaResumen = {
  Id: string;
  IdEmpleado: string;
  Nombre: string;
  NombreEmpleado: string;
  Rfc: string;
  NumEmpleado: string;
  FechaBaja: string | null;
  TipoNomina: string;
  Periodicidad: string | null;
  FechaInicialPago: string | null;
  FechaFinalPago: string | null;
  FechaPago: string | null;
  DiasPagados: string | null;
  Serie: string | null;
  TotalPercepciones: string;
  TotalDeducciones: string;
  TotalOtrosPagos: string;
  Neto: string;
  /** Con mysqlnd llega como número; sin él, como cadena. Solo se pinta. */
  Version: string | number;
  Estado: "BORRADOR" | "TIMBRADA" | "ERROR";
  VecesTimbrada: string | number;
  UltimoUuid: string | null;
  UltimoIdFactura: string | number | null;
  UltimoTimbrado: string | null;
  UltimoError: string | null;
  FechaReg: string | null;
  FechaMod: string | null;
};

export type PrenominaDetalle = PrenominaResumen & { Datos: NominaManualForm };

export type ResultadoNominaManual = {
  ok: boolean;
  nombre: string;
  serie: string;
  folio: string;
  neto: string;
  uuid?: string;
  fechaTimbrado?: string;
  error?: string;
  /** Lo que el backend encontró mal en el formulario, por campo. */
  errores?: ProblemaManual[];
};

const MODO_TIMBRADO = process.env.MODO_TIMBRADO || "PRUEBAS";

function base64(datos: unknown) {
  return Buffer.from(JSON.stringify(datos)).toString("base64");
}

/* -------------------------------------------------------------------------- */
/* Prenóminas                                                                 */
/* -------------------------------------------------------------------------- */

export async function getPrenominas(rfcEmisor: string, idEmpleado?: string): Promise<PrenominaResumen[]> {
  const resp = await llamar<{ Prenominas: PrenominaResumen[] }>("getPrenominasNominaV2.php", {
    RfcEmisor: rfcEmisor,
    ...(idEmpleado ? { IdEmpleado: idEmpleado } : {}),
  });
  return resp.Error === "0" ? resp.Prenominas ?? [] : [];
}

export async function getPrenomina(rfcEmisor: string, id: string) {
  return llamar<{ Prenomina: PrenominaDetalle }>("getPrenominaNominaV2.php", { RfcEmisor: rfcEmisor, Id: id });
}

export async function savePrenomina(rfcEmisor: string, nombre: string, form: NominaManualForm, id?: string) {
  return llamar<{ Id: string; Prenomina: PrenominaResumen; Errores: ProblemaManual[]; Avisos: string[] }>(
    "setPrenominaNominaV2.php",
    {
      RfcEmisor: rfcEmisor,
      ...(id ? { Id: id } : {}),
      DatosJSON: base64({ Nombre: nombre, Form: form }),
    }
  );
}

export async function deletePrenomina(rfcEmisor: string, id: string) {
  return llamar("deletePrenominaNominaV2.php", { RfcEmisor: rfcEmisor, Id: id });
}

/* -------------------------------------------------------------------------- */
/* Propuesta y armado                                                         */
/* -------------------------------------------------------------------------- */

export async function proponerRecibo(
  rfcEmisor: string,
  idEmpleado: string,
  periodo: NominaManualForm["periodo"]
) {
  return llamar<PropuestaRecibo>("proponerReciboNominaV2.php", {
    RfcEmisor: rfcEmisor,
    IdEmpleado: idEmpleado,
    DatosJSON: base64({
      TipoNomina: periodo.tipoNomina,
      Periodicidad: periodo.periodicidad,
      FechaInicialPago: periodo.fechaInicialPago,
      FechaFinalPago: periodo.fechaFinalPago,
      FechaPago: periodo.fechaPago,
      DiasPagados: periodo.diasPagados,
    }),
  });
}

type CfdiArmado = {
  Nombre: string;
  Rfc: string;
  Serie: string;
  Folio: string;
  Neto: string;
  Totales: Record<string, number | string>;
  Avisos: string[];
  DatosJSON: string;
  /** Solo cuando Error es "1" por el formulario. */
  Errores?: ProblemaManual[];
};

/** Los errores por campo que el backend adjunta cuando rechaza el formulario. */
function erroresDe(resp: unknown): ProblemaManual[] | undefined {
  const e = (resp as { Errores?: unknown }).Errores;
  return Array.isArray(e) ? (e as ProblemaManual[]) : undefined;
}

/** El CFDI armado por el backend (DatosJSON en base64), sin timbrar. */
export async function armarCfdiManual(rfcEmisor: string, form: NominaManualForm) {
  return llamar<CfdiArmado>("getCfdiNominaManualV2.php", {
    RfcEmisor: rfcEmisor,
    DatosJSON: base64(form),
  });
}

/**
 * Ensaya el timbrado sin timbrar: arma el comprobante y lo pasa por los
 * esquemas y reglas del SAT. No consume timbres.
 */
export type ResultadoValidacionManual =
  | { ok: true; datos: ValidarResult; serie: string; folio: string; avisos: string[] }
  | { ok: false; motivo: string; errores?: ProblemaManual[] };

export async function validarNominaManual(
  rfcEmisor: string,
  emisorToken: string,
  form: NominaManualForm
): Promise<ResultadoValidacionManual> {
  const session = await getSession();
  if (!session) return { ok: false, motivo: "No autenticado" };

  const armado = await armarCfdiManual(rfcEmisor, form);
  if (armado.Error !== "0") {
    return { ok: false, motivo: armado.DescripError, errores: erroresDe(armado) };
  }

  const resp: PhpResponse<ValidarResult> = await callLegacyPhpApi<ValidarResult>("/endpoint/apiTimbradoV2.php", {
    SessionToken: session.token,
    Token: emisorToken,
    Tarea: "VALIDACION",
    ModoTimbrado: MODO_TIMBRADO,
    DatosJSON: armado.DatosJSON,
  });
  if (resp.Error !== "0") return { ok: false, motivo: resp.DescripError };
  return { ok: true, datos: resp, serie: armado.Serie, folio: armado.Folio, avisos: armado.Avisos ?? [] };
}

/**
 * Timbra la nómina manual de principio a fin: arma, timbra con el mismo
 * endpoint que las facturas y la corrida (descuenta el timbre, guarda la
 * FACTURA y la FACTURA_NOMINA), y si venía de una prenómina anota el
 * resultado en ella, pase lo que pase, igual que timbrarRecibo.
 */
export async function timbrarNominaManual(
  rfcEmisor: string,
  emisorToken: string,
  form: NominaManualForm,
  idPrenomina?: string
): Promise<ResultadoNominaManual> {
  const session = await getSession();
  if (!session) {
    return { ok: false, nombre: "", serie: form.serie, folio: "", neto: "0", error: "No autenticado" };
  }

  const armado = await armarCfdiManual(rfcEmisor, form);
  if (armado.Error !== "0") {
    return {
      ok: false, nombre: "", serie: form.serie, folio: "", neto: "0",
      error: armado.DescripError, errores: erroresDe(armado),
    };
  }

  const base = { nombre: armado.Nombre, serie: armado.Serie, folio: armado.Folio, neto: armado.Neto };

  const timbre = await callLegacyPhpApi<{ UUID: string; FechaTimbrado: string }>("/endpoint/apiTimbradoV2.php", {
    SessionToken: session.token,
    Token: emisorToken,
    Tarea: "TIMBRADO",
    ModoTimbrado: MODO_TIMBRADO,
    DatosJSON: armado.DatosJSON,
  });

  if (idPrenomina) {
    await llamar("marcarPrenominaNominaV2.php", {
      RfcEmisor: rfcEmisor,
      Id: idPrenomina,
      Estado: timbre.Error === "0" ? "TIMBRADA" : "ERROR",
      ...(timbre.Error === "0" ? { UUID: timbre.UUID } : { Mensaje: timbre.DescripError }),
    });
  }

  return timbre.Error === "0"
    ? { ...base, ok: true, uuid: timbre.UUID, fechaTimbrado: timbre.FechaTimbrado }
    : { ...base, ok: false, error: timbre.DescripError };
}
