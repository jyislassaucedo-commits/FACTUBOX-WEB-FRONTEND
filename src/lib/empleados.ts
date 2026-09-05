import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";

/**
 * Un empleado tal como lo devuelve el backend.
 *
 * Los nombres son los atributos del complemento de nómina 1.2, no los de las
 * columnas: así lo que se lee aquí se puede volcar tal cual al CFDI cuando se
 * arme el recibo, sin una tabla de equivalencias en medio.
 *
 * Los opcionales son los que la base admite en NULL. `FechaBaja` en null es
 * lo que significa "sigue contratado" — no hay un campo "activo" aparte.
 */
export type Empleado = {
  Id: string;
  Rfc: string;
  Nombre: string;
  DomicilioFiscal: string;
  RegimenFiscal: string;
  Curp: string;
  NumSeguridadSocial: string;
  FechaInicioRelLaboral: string;
  TipoContrato: string;
  Sindicalizado: string;
  TipoJornada: string;
  TipoRegimen: string;
  NumEmpleado: string;
  Departamento: string;
  Puesto: string;
  RiesgoPuesto: string;
  PeriodicidadPago: string;
  Banco: string;
  CuentaBancaria: string;
  SalarioBaseCotApor: string;
  SalarioDiarioIntegrado: string;
  ClaveEntFed: string;
  SalarioDiario: string | null;
  RegistroPatronal: string | null;
  Email: string | null;
  FechaBaja: string | null;
  FechaReg: string | null;
  FechaMod: string | null;
};

/** Lo que el backend avisa que le falta a un empleado para poder timbrarle. */
export type FaltanteEmpleado = {
  campo: string;
  mensaje: string;
};

/**
 * Lo que manda el formulario. Todo texto porque así viaja al PHP y así lo
 * espera el CFDI; convertir a número aquí solo serviría para volver a
 * formatear al final.
 */
export type EmpleadoInput = {
  rfc: string;
  nombre: string;
  fechaInicioRelLaboral: string;
  curp?: string;
  numSeguridadSocial?: string;
  domicilioFiscal?: string;
  regimenFiscal?: string;
  tipoContrato?: string;
  sindicalizado?: string;
  tipoJornada?: string;
  tipoRegimen?: string;
  numEmpleado?: string;
  departamento?: string;
  puesto?: string;
  riesgoPuesto?: string;
  periodicidadPago?: string;
  banco?: string;
  cuentaBancaria?: string;
  salarioBaseCotApor?: string;
  salarioDiarioIntegrado?: string;
  claveEntFed?: string;
  salarioDiario?: string;
  registroPatronal?: string;
  email?: string;
};

/** Traduce el input de la pantalla al JSON que espera el endpoint PHP. */
function aDatosJSON(input: EmpleadoInput) {
  return {
    Rfc: input.rfc,
    Nombre: input.nombre,
    FechaInicioRelLaboral: input.fechaInicioRelLaboral,
    Curp: input.curp ?? "",
    NumSeguridadSocial: input.numSeguridadSocial ?? "",
    DomicilioFiscal: input.domicilioFiscal ?? "",
    RegimenFiscal: input.regimenFiscal ?? "",
    TipoContrato: input.tipoContrato ?? "",
    Sindicalizado: input.sindicalizado ?? "",
    TipoJornada: input.tipoJornada ?? "",
    TipoRegimen: input.tipoRegimen ?? "",
    NumEmpleado: input.numEmpleado ?? "",
    Departamento: input.departamento ?? "",
    Puesto: input.puesto ?? "",
    RiesgoPuesto: input.riesgoPuesto ?? "",
    PeriodicidadPago: input.periodicidadPago ?? "",
    Banco: input.banco ?? "",
    CuentaBancaria: input.cuentaBancaria ?? "",
    SalarioBaseCotApor: input.salarioBaseCotApor ?? "",
    SalarioDiarioIntegrado: input.salarioDiarioIntegrado ?? "",
    ClaveEntFed: input.claveEntFed ?? "",
    SalarioDiario: input.salarioDiario ?? "",
    RegistroPatronal: input.registroPatronal ?? "",
    Email: input.email ?? "",
  };
}

function base64(datos: unknown) {
  return Buffer.from(JSON.stringify(datos)).toString("base64");
}

export async function getEmpleados(
  rfcEmisor: string,
  incluirBajas = false
): Promise<Empleado[]> {
  const session = await getSession();
  if (!session) return [];

  const resp = await callLegacyPhpApi<{ Empleados: Empleado[] }>(
    "/maa/mvc/Empleado/api/getEmpleadosV2.php",
    {
      Token: session.token,
      RfcEmisor: rfcEmisor,
      IncluirBajas: incluirBajas ? "1" : "0",
    }
  );

  if (resp.Error !== "0") return [];
  return resp.Empleados ?? [];
}

export async function saveEmpleado(
  rfcEmisor: string,
  input: EmpleadoInput
): Promise<PhpResponse<{ Id: string; Creado: string; Faltantes: FaltanteEmpleado[] }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  return callLegacyPhpApi("/maa/mvc/Empleado/api/setEmpleadoV2.php", {
    Token: session.token,
    RFCEmisor: rfcEmisor,
    DatosJSON: base64(aDatosJSON(input)),
  });
}

/** Edición por Id. Es el único camino que permite corregir un RFC: por
 *  saveEmpleado el RFC es la llave, así que cambiarlo crearía otro empleado. */
export async function editEmpleado(
  rfcEmisor: string,
  id: string,
  input: EmpleadoInput
): Promise<PhpResponse<{ Id: string; Faltantes: FaltanteEmpleado[] }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  return callLegacyPhpApi("/maa/mvc/Empleado/api/editEmpleadoV2.php", {
    Token: session.token,
    RFCEmisor: rfcEmisor,
    Id: id,
    DatosJSON: base64(aDatosJSON(input)),
  });
}

/**
 * Baja o reactivación. Nunca borra: los recibos de nómina ya timbrados
 * apuntan al empleado, y un CFDI emitido no se queda sin dueño porque alguien
 * dejó de trabajar ahí.
 */
export async function bajaEmpleado(
  rfcEmisor: string,
  id: string,
  opciones: { reactivar?: boolean; fechaBaja?: string } = {}
): Promise<PhpResponse<{ Id: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  return callLegacyPhpApi("/maa/mvc/Empleado/api/deleteEmpleadoV2.php", {
    Token: session.token,
    RfcEmisor: rfcEmisor,
    Id: id,
    Reactivar: opciones.reactivar ? "1" : "0",
    ...(opciones.fechaBaja ? { FechaBaja: opciones.fechaBaja } : {}),
  });
}

export async function getRegistroPatronal(rfcEmisor: string): Promise<string> {
  const session = await getSession();
  if (!session) return "";

  const resp = await callLegacyPhpApi<{ RegistroPatronal: string }>(
    "/maa/mvc/Empresa/api/getRegistroPatronalV2.php",
    { Token: session.token, RfcEmisor: rfcEmisor }
  );

  if (resp.Error !== "0") return "";
  return resp.RegistroPatronal ?? "";
}

export async function saveRegistroPatronal(
  rfcEmisor: string,
  valor: string
): Promise<PhpResponse<{ RegistroPatronal: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  return callLegacyPhpApi("/maa/mvc/Empresa/api/setRegistroPatronalV2.php", {
    Token: session.token,
    RfcEmisor: rfcEmisor,
    RegistroPatronal: valor,
  });
}
