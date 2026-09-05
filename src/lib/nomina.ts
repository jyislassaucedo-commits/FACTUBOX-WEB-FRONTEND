import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";

const RUTA = "/maa/mvc/Nomina/api";

export type PeriodoNomina = {
  Id: string;
  IdEmpresa: string;
  TipoNomina: string;
  Periodicidad: string;
  FechaInicialPago: string;
  FechaFinalPago: string;
  FechaPago: string;
  DiasPagados: string;
  Descripcion: string | null;
  Estado: "BORRADOR" | "CERRADO";
  /** Solo en la lista: los conteos que se preguntan el día de pago. */
  Recibos?: string;
  Timbrados?: string;
  ConError?: string;
  TotalNeto?: string;
};

export type ReciboNomina = {
  Id: string;
  IdEmpleado: string;
  Rfc: string;
  Nombre: string;
  NumEmpleado: string;
  Puesto: string;
  DiasPagados: string;
  TotalPercepciones: string;
  TotalDeducciones: string;
  TotalOtrosPagos: string;
  IsrCausado: string;
  SubsidioCausado: string;
  SubsidioEntregado: string;
  IsrRetenido: string;
  Neto: string;
  Estado: "BORRADOR" | "TIMBRADO" | "ERROR";
  IdFactura: string | null;
  Error: string | null;
};

/** Un renglón del recibo, tal como va al XML. */
export type ConceptoRecibo = {
  grupo: "PERCEPCION" | "DEDUCCION" | "OTRO_PAGO";
  tipo: string;
  clave: string;
  concepto: string;
  importe_gravado: string;
  importe_exento: string;
  orden: string;
};

export type IncidenciaNomina = {
  id: string;
  tipo: string;
  dias: string | null;
  horas: string | null;
  tipo_horas: string | null;
  dias_horas_extra: string | null;
  tipo_incapacidad: string | null;
  clave_sat: string | null;
  concepto: string | null;
  importe: string | null;
  importe_exento: string | null;
  nota: string | null;
};

export type PeriodoInput = {
  tipoNomina?: string;
  periodicidad: string;
  fechaInicialPago: string;
  fechaFinalPago: string;
  fechaPago: string;
  diasPagados: string;
  descripcion?: string;
};

export type IncidenciaInput = {
  idEmpleado: string;
  tipo: string;
  dias?: string;
  horas?: string;
  tipoHoras?: string;
  diasHorasExtra?: string;
  tipoIncapacidad?: string;
  claveSat?: string;
  concepto?: string;
  importe?: string;
  importeExento?: string;
  nota?: string;
};

function base64(datos: unknown) {
  return Buffer.from(JSON.stringify(datos)).toString("base64");
}

async function llamar<T>(endpoint: string, params: Record<string, string>): Promise<PhpResponse<T>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi<T>(`${RUTA}/${endpoint}`, { Token: session.token, ...params });
}

export async function getPeriodos(rfcEmisor: string): Promise<PeriodoNomina[]> {
  const resp = await llamar<{ Periodos: PeriodoNomina[] }>("getPeriodosNominaV2.php", {
    RfcEmisor: rfcEmisor,
  });
  if (resp.Error !== "0") return [];
  return resp.Periodos ?? [];
}

export async function getPeriodo(
  rfcEmisor: string,
  id: string
): Promise<
  PhpResponse<{
    Periodo: PeriodoNomina;
    Recibos: ReciboNomina[];
    /** El desglose de cada recibo, por id de recibo. */
    Conceptos: Record<string, ConceptoRecibo[]>;
  }>
> {
  return llamar("getPeriodoNominaV2.php", { RfcEmisor: rfcEmisor, Id: id });
}

export async function savePeriodo(
  rfcEmisor: string,
  input: PeriodoInput,
  id?: string
): Promise<PhpResponse<{ Id: string; Periodo: PeriodoNomina }>> {
  return llamar("setPeriodoNominaV2.php", {
    RfcEmisor: rfcEmisor,
    ...(id ? { Id: id } : {}),
    DatosJSON: base64({
      TipoNomina: input.tipoNomina ?? "O",
      Periodicidad: input.periodicidad,
      FechaInicialPago: input.fechaInicialPago,
      FechaFinalPago: input.fechaFinalPago,
      FechaPago: input.fechaPago,
      DiasPagados: input.diasPagados,
      Descripcion: input.descripcion ?? "",
    }),
  });
}

export async function deletePeriodo(rfcEmisor: string, id: string) {
  return llamar("deletePeriodoNominaV2.php", { RfcEmisor: rfcEmisor, Id: id });
}

/** Lo que faltó calcular viene con nombre y motivo, no como un número. */
export async function calcularNomina(
  rfcEmisor: string,
  id: string,
  /** Ids de los empleados elegidos. Sin esto se barre a todos los de la
   *  periodicidad del periodo, que es lo que casi siempre se quiere pero no
   *  siempre. */
  empleados?: string[]
): Promise<
  PhpResponse<{
    Empleados: number;
    Calculados: { Nombre: string; Neto: string; Incidencias: number }[];
    Omitidos: { Nombre: string; Motivo: string }[];
    Avisos: { Nombre: string; Aviso: string }[];
    Nota: string | null;
    Recibos: ReciboNomina[];
  }>
> {
  return llamar("calcularNominaV2.php", {
    RfcEmisor: rfcEmisor,
    Id: id,
    ...(empleados && empleados.length > 0 ? { Empleados: empleados.join(",") } : {}),
  });
}

export async function saveIncidencia(rfcEmisor: string, idPeriodo: string, input: IncidenciaInput) {
  return llamar<{ Incidencias: IncidenciaNomina[] }>("setIncidenciaNominaV2.php", {
    RfcEmisor: rfcEmisor,
    IdPeriodo: idPeriodo,
    DatosJSON: base64({
      IdEmpleado: input.idEmpleado,
      Tipo: input.tipo,
      Dias: input.dias ?? "",
      Horas: input.horas ?? "",
      TipoHoras: input.tipoHoras ?? "",
      DiasHorasExtra: input.diasHorasExtra ?? "",
      TipoIncapacidad: input.tipoIncapacidad ?? "",
      ClaveSat: input.claveSat ?? "",
      Concepto: input.concepto ?? "",
      Importe: input.importe ?? "",
      ImporteExento: input.importeExento ?? "",
      Nota: input.nota ?? "",
    }),
  });
}

export async function getIncidencias(rfcEmisor: string, idPeriodo: string) {
  return llamar<{ PorEmpleado: Record<string, IncidenciaNomina[]> }>(
    "getIncidenciasNominaV2.php",
    { RfcEmisor: rfcEmisor, IdPeriodo: idPeriodo }
  );
}

export async function deleteIncidencia(rfcEmisor: string, idPeriodo: string, id: string) {
  return llamar("deleteIncidenciaNominaV2.php", { RfcEmisor: rfcEmisor, IdPeriodo: idPeriodo, Id: id });
}

/* -------------------------------------------------------------------------- */
/* Timbrado                                                                   */
/* -------------------------------------------------------------------------- */

export type ResultadoTimbradoRecibo = {
  nombre: string;
  rfc: string;
  serie: string;
  folio: string;
  neto: string;
  ok: boolean;
  uuid?: string;
  error?: string;
};

/**
 * Timbra el recibo de un empleado, de principio a fin.
 *
 * Tres pasos, y ninguno se salta: el backend arma el CFDI y resuelve el folio,
 * `apiTimbradoV2` lo timbra —el mismo endpoint que las facturas, que descuenta
 * el timbre, guarda la FACTURA y valida antes de gastarlo—, y al final se
 * marca el recibo con el UUID que de verdad quedó.
 *
 * Va de uno en uno a propósito. El lote lo recorre quien llama, para que el
 * avance se vea empleado por empleado y un rechazo no tumbe a los demás.
 */
export async function timbrarRecibo(
  rfcEmisor: string,
  emisorToken: string,
  idPeriodo: string,
  idEmpleado: string,
  serie: string
): Promise<ResultadoTimbradoRecibo> {
  const session = await getSession();
  if (!session) {
    return { nombre: "", rfc: "", serie, folio: "", neto: "0", ok: false, error: "No autenticado" };
  }

  const armado = await callLegacyPhpApi<{
    Nombre: string; Rfc: string; Serie: string; Folio: string; Neto: string; DatosJSON: string;
  }>(`${RUTA}/getCfdiNominaV2.php`, {
    Token: session.token, RfcEmisor: rfcEmisor, IdPeriodo: idPeriodo,
    IdEmpleado: idEmpleado, Serie: serie,
  });

  if (armado.Error !== "0") {
    return { nombre: "", rfc: "", serie, folio: "", neto: "0", ok: false, error: armado.DescripError };
  }

  const base = {
    nombre: armado.Nombre, rfc: armado.Rfc, serie: armado.Serie,
    folio: armado.Folio, neto: armado.Neto,
  };

  const timbre = await callLegacyPhpApi<{ UUID: string }>("/endpoint/apiTimbradoV2.php", {
    SessionToken: session.token,
    Token: emisorToken,
    Tarea: "TIMBRADO",
    ModoTimbrado: process.env.MODO_TIMBRADO || "PRUEBAS",
    DatosJSON: armado.DatosJSON,
  });

  // El recibo se marca pase lo que pase. Un timbrado que falló y no queda
  // registrado se vuelve a intentar a ciegas, y el segundo intento sí puede
  // gastar el timbre.
  await callLegacyPhpApi(`${RUTA}/marcarReciboNominaV2.php`, {
    Token: session.token, RfcEmisor: rfcEmisor, IdPeriodo: idPeriodo, IdEmpleado: idEmpleado,
    Estado: timbre.Error === "0" ? "TIMBRADO" : "ERROR",
    ...(timbre.Error === "0" ? { UUID: timbre.UUID } : { Mensaje: timbre.DescripError }),
  });

  return timbre.Error === "0"
    ? { ...base, ok: true, uuid: timbre.UUID }
    : { ...base, ok: false, error: timbre.DescripError };
}

/* -------------------------------------------------------------------------- */
/* A quién le toca                                                            */
/* -------------------------------------------------------------------------- */

/** Un empleado como candidato a entrar en una corrida, con las banderas que
 *  necesita la pantalla para proponer sin imponer. */
export type CandidatoNomina = {
  Id: string;
  Rfc: string;
  Nombre: string;
  NumEmpleado: string;
  Puesto: string;
  PeriodicidadPago: string;
  SalarioDiario: string | null;
  FechaBaja: string | null;
  /** Su periodicidad es la del periodo: son los que entrarían solos. */
  Coincide: "0" | "1";
  DadoDeBaja: "0" | "1";
  YaTieneRecibo: "0" | "1";
  Timbrado: "0" | "1";
  Faltantes: { campo: string; mensaje: string }[];
};

export async function getCandidatos(rfcEmisor: string, idPeriodo: string) {
  return llamar<{ Candidatos: CandidatoNomina[] }>("getCandidatosNominaV2.php", {
    RfcEmisor: rfcEmisor,
    IdPeriodo: idPeriodo,
  });
}

/** Saca a alguien de la corrida. No borra sus incidencias. */
export async function quitarRecibo(rfcEmisor: string, idPeriodo: string, idEmpleado: string) {
  return llamar("deleteReciboNominaV2.php", {
    RfcEmisor: rfcEmisor,
    IdPeriodo: idPeriodo,
    IdEmpleado: idEmpleado,
  });
}
