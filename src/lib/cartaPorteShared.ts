/*
   Catálogos de carta porte: tipos y reglas que usan tanto el servidor (BFF)
   como las pantallas.

   Los nombres de campo son los de las columnas del SQLite de Factubox
   Escritorio Carta Porte (y de las tablas CP_* del servidor), tal cual, con
   sus mayúsculas raras incluidas (Pesobrutovehicular, SubTipoRemCCP...): así
   un registro viaja sin traducción entre web, servidor y escritorio.
*/

export type EntidadCP = "transporte" | "figura" | "ubicacion" | "mercancia";

export const ENTIDADES_CP: EntidadCP[] = ["transporte", "figura", "ubicacion", "mercancia"];

export function esEntidadCP(v: string): v is EntidadCP {
  return (ENTIDADES_CP as string[]).includes(v);
}

/** c_CveTransporte */
export type MedioCP = "01" | "02" | "03" | "04";

export const MEDIOS_CP: Array<{ id: MedioCP; nombre: string; hijo: "autotransporte" | "maritimo" | "aereo" | "ferroviario" }> = [
  { id: "01", nombre: "Autotransporte", hijo: "autotransporte" },
  { id: "02", nombre: "Marítimo", hijo: "maritimo" },
  { id: "03", nombre: "Aéreo", hijo: "aereo" },
  { id: "04", nombre: "Ferroviario", hijo: "ferroviario" },
];

export function nombreMedio(id: string) {
  return MEDIOS_CP.find((m) => m.id === id)?.nombre ?? (id || "Sin medio");
}

type Base = { id?: number; fechareg?: string | null; fechamod?: string | null };

export type RemolqueAuto = { subtiporem: string; placa: string };
export type Autotransporte = {
  configvehicular: string;
  placavm: string;
  aniomodelovm: string;
  asegurarespcivil: string;
  polizarespcivil: string;
  aseguramedambiente: string;
  polizamedambiente: string;
  aseguracarga: string;
  polizacarga: string;
  primaseguro: string;
  Pesobrutovehicular: string;
  remolques: RemolqueAuto[];
};
export type RemolqueMaritimo = { SubTipoRemCCP: string; PlacaCCP: string };
export type ContenedorMaritimo = {
  matriculacontenedor: string;
  tipocontenedor: string;
  numprecinto: string;
  IdCCPRelacionado: string;
  PlacaVMCCP: string;
  FechaCertificacionCCP: string;
  remolques: RemolqueMaritimo[];
};
export type Maritimo = {
  tipoembarcacion: string;
  matricula: string;
  numeroomi: string;
  nombreembarc: string;
  nacionalidadembarc: string;
  unidadesdearqbruto: string;
  numcertitc: string;
  eslora: string;
  manga: string;
  calado: string;
  lineanaviera: string;
  nombreagentenaviero: string;
  numautorizacionnaviero: string;
  numconocembarc: string;
  Puntal: string;
  Permisotempnavegacion: string;
  contenedores: ContenedorMaritimo[];
};
export type Aereo = {
  matriculaaeronave: string;
  numeroguia: string;
  codigotransportista: string;
  rfcembarcador: string;
  numregidtribembarc: string;
  residenciafiscalembarc: string;
  nombreembarcador: string;
  numcertitc: string;
};
export type DerechoPaso = { tipoderechodepaso: string; kilometrajepagado: string };
export type ContenedorCarro = { tipocontenedor: string; pesocontenedorvacio: string };
export type CarroFerroviario = { tipocarro: string; matriculacarro: string; guiacarro: string; contenedores: ContenedorCarro[] };
export type Ferroviario = { tipodeservicio: string; tipodetrafico: string; derechosPaso: DerechoPaso[]; carros: CarroFerroviario[] };

export type TransporteCP = Base & {
  idlocal: string;
  alias: string;
  tipotransporte: MedioCP | "";
  permsct: string;
  numpermisosct: string;
  nombreaseg: string;
  numpolizaseguro: string;
  autotransporte: Autotransporte | null;
  maritimo: Maritimo | null;
  aereo: Aereo | null;
  ferroviario: Ferroviario | null;
};

export type Domicilio = {
  calle: string;
  numeroexterior: string;
  numerointerior: string;
  colonia: string;
  localidad: string;
  referencia: string;
  municipio: string;
  estado: string;
  pais: string;
  codigopostal: string;
};

export type FiguraCP = Base &
  Domicilio & {
    tipofigura: string;
    rfc: string;
    numlicencia: string;
    nombre: string;
    numregidtrib: string;
    residenciafiscal: string;
    /** "SI" cuando lleva domicilio (como el escritorio). */
    domicilio: string;
    partes: Array<{ partetransporte: string }>;
  };

export type UbicacionCP = Base &
  Domicilio & {
    tipotransporte: string;
    rfcremdest: string;
    nombreremdest: string;
    numregidtrib: string;
    residenciafiscal: string;
    numestacion: string;
    nombreestacion: string;
    navegaciontrafico: string;
    tipoestacion: string;
  };

export type MercanciaCP = Base & {
  claveprod: string;
  claveprodcp: string;
  descripcion: string;
  claveuni: string;
  unidad: string;
  dimensiones: string;
  materialpeligroso: string;
  clavepeligroso: string;
  embalaje: string;
  descembalaje: string;
  pesokg: string;
  valor: string;
  moneda: string;
  objetoimp: string;
  sectorcofepris: string;
  NombreIngredienteActivo: string;
  NomQuimico: string;
  DenominacionGenericaProd: string;
  DenominacionDistintivaProd: string;
  Fabricante: string;
  FechaCaducidad: string;
  LoteMedicamento: string;
  FormaFarmaceutica: string;
  CondicionesEspTransp: string;
  RegistroSanitarioFolioAutorizacion: string;
  PermisoImportacion: string;
  FolioImpoVUCEM: string;
  NumCAS: string;
  RazonSocialEmpImp: string;
  NumRegSanPlagCOFEPRIS: string;
  DatosFabricante: string;
  DatosFormulador: string;
  DatosMaquilador: string;
  UsoAutorizado: string;
  FraccionArrancelaria: string;
  TipoMateria: string;
  DescripcionMateria: string;
  Imagen: string;
};

export type RegistroCP = TransporteCP | FiguraCP | UbicacionCP | MercanciaCP;

export type PaginaCP<T> = { total: number; registros: T[] };

/* -------------------------------------------------------------------------- */
/* Registros vacíos                                                           */
/* -------------------------------------------------------------------------- */

export const DOMICILIO_VACIO: Domicilio = {
  calle: "",
  numeroexterior: "",
  numerointerior: "",
  colonia: "",
  localidad: "",
  referencia: "",
  municipio: "",
  estado: "",
  pais: "MEX",
  codigopostal: "",
};

export function autotransporteVacio(): Autotransporte {
  return {
    configvehicular: "",
    placavm: "",
    aniomodelovm: "",
    asegurarespcivil: "",
    polizarespcivil: "",
    aseguramedambiente: "",
    polizamedambiente: "",
    aseguracarga: "",
    polizacarga: "",
    primaseguro: "",
    Pesobrutovehicular: "",
    remolques: [],
  };
}
export function maritimoVacio(): Maritimo {
  return {
    tipoembarcacion: "",
    matricula: "",
    numeroomi: "",
    nombreembarc: "",
    nacionalidadembarc: "",
    unidadesdearqbruto: "",
    numcertitc: "",
    eslora: "",
    manga: "",
    calado: "",
    lineanaviera: "",
    nombreagentenaviero: "",
    numautorizacionnaviero: "",
    numconocembarc: "",
    Puntal: "",
    Permisotempnavegacion: "",
    contenedores: [],
  };
}
export function aereoVacio(): Aereo {
  return {
    matriculaaeronave: "",
    numeroguia: "",
    codigotransportista: "",
    rfcembarcador: "",
    numregidtribembarc: "",
    residenciafiscalembarc: "",
    nombreembarcador: "",
    numcertitc: "",
  };
}
export function ferroviarioVacio(): Ferroviario {
  return { tipodeservicio: "", tipodetrafico: "", derechosPaso: [], carros: [] };
}

export function transporteVacio(medio: MedioCP = "01"): TransporteCP {
  return {
    idlocal: "",
    alias: "",
    tipotransporte: medio,
    permsct: "",
    numpermisosct: "",
    nombreaseg: "",
    numpolizaseguro: "",
    autotransporte: medio === "01" ? autotransporteVacio() : null,
    maritimo: medio === "02" ? maritimoVacio() : null,
    aereo: medio === "03" ? aereoVacio() : null,
    ferroviario: medio === "04" ? ferroviarioVacio() : null,
  };
}

export function figuraVacia(): FiguraCP {
  return {
    ...DOMICILIO_VACIO,
    tipofigura: "01",
    rfc: "",
    numlicencia: "",
    nombre: "",
    numregidtrib: "",
    residenciafiscal: "",
    domicilio: "NO",
    partes: [],
  };
}

export function ubicacionVacia(): UbicacionCP {
  return {
    ...DOMICILIO_VACIO,
    tipotransporte: "01",
    rfcremdest: "",
    nombreremdest: "",
    numregidtrib: "",
    residenciafiscal: "",
    numestacion: "",
    nombreestacion: "",
    navegaciontrafico: "",
    tipoestacion: "",
  };
}

export function mercanciaVacia(): MercanciaCP {
  return {
    claveprod: "",
    claveprodcp: "",
    descripcion: "",
    claveuni: "",
    unidad: "",
    dimensiones: "",
    materialpeligroso: "",
    clavepeligroso: "",
    embalaje: "",
    descembalaje: "",
    pesokg: "",
    valor: "",
    moneda: "MXN",
    objetoimp: "",
    sectorcofepris: "",
    NombreIngredienteActivo: "",
    NomQuimico: "",
    DenominacionGenericaProd: "",
    DenominacionDistintivaProd: "",
    Fabricante: "",
    FechaCaducidad: "",
    LoteMedicamento: "",
    FormaFarmaceutica: "",
    CondicionesEspTransp: "",
    RegistroSanitarioFolioAutorizacion: "",
    PermisoImportacion: "",
    FolioImpoVUCEM: "",
    NumCAS: "",
    RazonSocialEmpImp: "",
    NumRegSanPlagCOFEPRIS: "",
    DatosFabricante: "",
    DatosFormulador: "",
    DatosMaquilador: "",
    UsoAutorizado: "",
    FraccionArrancelaria: "",
    TipoMateria: "",
    DescripcionMateria: "",
    Imagen: "",
  };
}

/* -------------------------------------------------------------------------- */
/* Validaciones de formulario (las del escritorio)                            */
/* -------------------------------------------------------------------------- */

/** Campo -> mensaje. Vacío = se puede guardar. */
export type ErroresCP = Record<string, string>;

const RE_RFC = /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/;
const RE_PLACA = /^[A-Z0-9]{5,7}$/;

export function esRfcValido(rfc: string) {
  return RE_RFC.test(rfc.trim().toUpperCase());
}

function requerido(e: ErroresCP, campo: string, valor: string | undefined, mensaje: string) {
  if (!valor?.trim()) e[campo] = mensaje;
}

/**
 * Lo que pide el escritorio al guardar un transporte (frmPopNuevoAutotransporte
 * y los formularios de los otros medios), con el mismo criterio.
 *
 * @param configPideRemolque la configuración vehicular exige remolque (catálogo, columna "remolque" = 1)
 */
export function validarTransporte(t: TransporteCP, configPideRemolque = false): ErroresCP {
  const e: ErroresCP = {};
  requerido(e, "alias", t.alias, "Ponle un nombre para reconocerlo");
  requerido(e, "tipotransporte", t.tipotransporte, "Elige el medio de transporte");
  if (t.tipotransporte === "01") {
    const a = t.autotransporte;
    requerido(e, "permsct", t.permsct, "Elige el tipo de permiso SCT");
    requerido(e, "numpermisosct", t.numpermisosct, "Escribe el número de permiso");
    if (!a) return e;
    requerido(e, "configvehicular", a.configvehicular, "Elige la configuración vehicular");
    if (!RE_PLACA.test(a.placavm.trim().toUpperCase())) e.placavm = "La placa son de 5 a 7 letras o números, sin guiones";
    const anio = Number(a.aniomodelovm);
    if (!/^\d{4}$/.test(a.aniomodelovm.trim()) || anio < 1900 || anio > 2099) e.aniomodelovm = "Año de 4 dígitos entre 1900 y 2099";
    if (a.Pesobrutovehicular.trim() && !(Number(a.Pesobrutovehicular) > 0)) e.Pesobrutovehicular = "Número mayor que cero, en toneladas";
    requerido(e, "asegurarespcivil", a.asegurarespcivil, "La aseguradora de responsabilidad civil es obligatoria");
    requerido(e, "polizarespcivil", a.polizarespcivil, "La póliza de responsabilidad civil es obligatoria");
    if (a.primaseguro.trim() && Number.isNaN(Number(a.primaseguro))) e.primaseguro = "La prima es un número";
    if (a.remolques.length > 2) e.remolques = "Máximo 2 remolques";
    if (configPideRemolque && a.remolques.length === 0) e.remolques = "Esta configuración lleva al menos un remolque";
    a.remolques.forEach((r, i) => {
      if (!r.subtiporem) e[`remolques.${i}.subtiporem`] = "Elige el tipo de remolque";
      if (!RE_PLACA.test(r.placa.trim().toUpperCase())) e[`remolques.${i}.placa`] = "Placa de 5 a 7 letras o números";
    });
  }
  if (t.tipotransporte === "02" && t.maritimo) {
    const m = t.maritimo;
    requerido(e, "tipoembarcacion", m.tipoembarcacion, "Elige el tipo de embarcación");
    requerido(e, "matricula", m.matricula, "La matrícula es obligatoria");
    requerido(e, "numeroomi", m.numeroomi, "El número OMI es obligatorio");
    requerido(e, "nacionalidadembarc", m.nacionalidadembarc, "Elige la nacionalidad");
    requerido(e, "unidadesdearqbruto", m.unidadesdearqbruto, "Escribe las unidades de arqueo bruto");
    requerido(e, "numcertitc", m.numcertitc, "El certificado ITC es obligatorio");
    requerido(e, "nombreagentenaviero", m.nombreagentenaviero, "El agente naviero es obligatorio");
    requerido(e, "numautorizacionnaviero", m.numautorizacionnaviero, "La autorización del naviero es obligatoria");
    for (const c of ["eslora", "manga", "calado", "Puntal"] as const) {
      if (m[c].trim() && !(Number(m[c]) > 0)) e[c] = "Número mayor que cero";
    }
  }
  if (t.tipotransporte === "03" && t.aereo) {
    const a = t.aereo;
    requerido(e, "permsct", t.permsct, "Elige el tipo de permiso SCT");
    requerido(e, "numpermisosct", t.numpermisosct, "Escribe el número de permiso");
    requerido(e, "numeroguia", a.numeroguia, "El número de guía es obligatorio");
    requerido(e, "codigotransportista", a.codigotransportista, "Elige el código del transportista");
    if (a.rfcembarcador.trim() && !esRfcValido(a.rfcembarcador)) e.rfcembarcador = "RFC con formato inválido";
  }
  if (t.tipotransporte === "04" && t.ferroviario) {
    const f = t.ferroviario;
    requerido(e, "tipodeservicio", f.tipodeservicio, "Elige el tipo de servicio");
    requerido(e, "tipodetrafico", f.tipodetrafico, "Elige el tipo de tráfico");
    requerido(e, "nombreaseg", t.nombreaseg, "La aseguradora es obligatoria");
    if (f.carros.length === 0) e.carros = "Agrega al menos un carro";
    f.carros.forEach((c, i) => {
      if (!c.tipocarro) e[`carros.${i}.tipocarro`] = "Elige el tipo de carro";
      requerido(e, `carros.${i}.matriculacarro`, c.matriculacarro, "La matrícula es obligatoria");
      requerido(e, `carros.${i}.guiacarro`, c.guiacarro, "La guía es obligatoria");
    });
  }
  return e;
}

/** Figura de transporte (frmPopNuevaFigTransporte20). */
export function validarFigura(f: FiguraCP): ErroresCP {
  const e: ErroresCP = {};
  requerido(e, "tipofigura", f.tipofigura, "Elige el tipo de figura");
  requerido(e, "nombre", f.nombre, "El nombre es obligatorio");
  const extranjero = !!f.residenciafiscal && f.residenciafiscal !== "MEX";
  if (extranjero) {
    requerido(e, "numregidtrib", f.numregidtrib, "El registro de identidad tributaria es obligatorio para extranjeros");
  } else if (!esRfcValido(f.rfc)) {
    e.rfc = "RFC con formato inválido";
  }
  if (f.tipofigura === "01") requerido(e, "numlicencia", f.numlicencia, "El operador necesita su número de licencia");
  if ((f.tipofigura === "02" || f.tipofigura === "03") && f.partes.length === 0) {
    e.partes = "El propietario y el arrendador llevan al menos una parte de transporte";
  }
  if (f.domicilio === "SI") validarDomicilio(f, e);
  return e;
}

export function validarUbicacion(u: UbicacionCP): ErroresCP {
  const e: ErroresCP = {};
  requerido(e, "nombreremdest", u.nombreremdest, "El nombre es obligatorio");
  const extranjero = !!u.residenciafiscal && u.residenciafiscal !== "MEX";
  if (extranjero) {
    requerido(e, "numregidtrib", u.numregidtrib, "El registro de identidad tributaria es obligatorio para extranjeros");
  } else if (!esRfcValido(u.rfcremdest)) {
    e.rfcremdest = "RFC con formato inválido";
  }
  if (u.tipotransporte && u.tipotransporte !== "01") {
    requerido(e, "numestacion", u.numestacion, "Elige la estación");
  }
  validarDomicilio(u, e);
  return e;
}

function validarDomicilio(d: Domicilio, e: ErroresCP) {
  requerido(e, "pais", d.pais, "Elige el país");
  requerido(e, "estado", d.estado, "Elige el estado");
  if (d.pais === "MEX") {
    if (!/^\d{5}$/.test(d.codigopostal.trim())) e.codigopostal = "El código postal son 5 dígitos";
  } else {
    requerido(e, "codigopostal", d.codigopostal, "El código postal es obligatorio");
  }
}

const RE_DIMENSIONES = /^([0-9]{1,3}\/){2}[0-9]{1,3}(cm|plg)$/;

/** Mercancía (frmPopNuevaMercancia20 y la importación de Excel). */
export function validarMercancia(m: MercanciaCP, pideMaterialPeligroso = false): ErroresCP {
  const e: ErroresCP = {};
  requerido(e, "claveprodcp", m.claveprodcp, "Elige la clave de bienes transportados");
  requerido(e, "descripcion", m.descripcion, "La descripción es obligatoria");
  if (m.descripcion.length > 1000) e.descripcion = "Máximo 1000 caracteres";
  requerido(e, "claveuni", m.claveuni, "Elige la clave de unidad");
  if (m.unidad.length > 20) e.unidad = "Máximo 20 caracteres";
  if (!(Number(m.pesokg) > 0)) e.pesokg = "El peso en kg es mayor que cero";
  if (m.valor.trim() && Number.isNaN(Number(m.valor))) e.valor = "El valor es un número";
  if (m.dimensiones.trim() && !RE_DIMENSIONES.test(m.dimensiones.trim())) e.dimensiones = "Como 30/40/50cm o 12/16/20plg";
  if (pideMaterialPeligroso) {
    if (m.materialpeligroso !== "Sí" && m.materialpeligroso !== "No") e.materialpeligroso = "Indica si es material peligroso";
    if (m.materialpeligroso === "Sí") {
      requerido(e, "clavepeligroso", m.clavepeligroso, "Elige la clave del material peligroso");
      requerido(e, "embalaje", m.embalaje, "Elige el embalaje");
    }
  }
  return e;
}
