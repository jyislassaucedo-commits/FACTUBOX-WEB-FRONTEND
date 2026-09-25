/* ---------------------------------------------------------------------------
   Los complementos chicos que el escritorio ya tenía y la web no.
   ---------------------------------------------------------------------------
   Todos son de campos planos (un nodo con atributos y, cuando mucho, un hijo
   único), así que caben en el paso de Complementos tal como está. Los campos
   y reglas salen del XSD del SAT de cada uno (el mismo que está en
   maa/core/recursosSat/xsd y contra el que valida VALIDADOR_SAT) y de los
   formularios de FACTUBOX-DESKTOP/Mvc/Complemento.

   `nodo` es el nombre del nodo raíz con las mayúsculas exactas del XSD: en
   mayúsculas es la llave con la que JSON_CFDI40.php reconoce el complemento y
   le pone su prefijo y su schemaLocation. En el XML solo importa el orden de
   los nodos hijos, no el de los atributos.

   Los que llevan listas repetibles (INE, Aerolíneas, Vales de despensa, Venta
   de vehículos) están en complementosListas.ts.
--------------------------------------------------------------------------- */

import type { DefComplemento, ProblemaComplemento } from "./complementos";
import { ENTIDADES, RFC, importe, sinVacios } from "./complementosUtil";

const t = (v: string | undefined) => (v ?? "").trim();
/** Un valor del JSON leído de una prefactura, como texto. */
const s = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "").trim();
/** Un nodo hijo del JSON (el primero, si viene como lista). */
const hijo = (v: unknown): Record<string, unknown> => {
  const o = Array.isArray(v) ? v[0] : v;
  return o && typeof o === "object" ? (o as Record<string, unknown>) : {};
};
const T = (v: string | undefined) => t(v).toUpperCase();

/** Revisa un campo contra una expresión; vacío no es error (eso lo ve `obligatorio`). */
function patron(d: Record<string, string>, campo: string, re: RegExp, mensaje: string): ProblemaComplemento[] {
  const v = t(d[campo]);
  return v && !re.test(v) ? [{ campo, mensaje }] : [];
}

/** Un importe mayor o igual a cero. */
function monto(d: Record<string, string>, campo: string, etiqueta: string): ProblemaComplemento[] {
  const v = t(d[campo]).replace(/,/g, "");
  return v && !(Number(v) >= 0) ? [{ campo, mensaje: `${etiqueta} no es un importe válido.` }] : [];
}

export const COMPLEMENTOS_EXTRA: DefComplemento[] = [
  {
    id: "donat",
    nombre: "Donatarias",
    descripcion: "Donativos deducibles recibidos por una donataria autorizada.",
    disponible: true,
    destino: "comprobante",
    nodo: "Donatarias",
    campos: [
      { id: "noAutorizacion", etiqueta: "Número de oficio de autorización", obligatorio: true },
      { id: "fechaAutorizacion", etiqueta: "Fecha del oficio", obligatorio: true, tipo: "fecha" },
      {
        id: "leyenda",
        etiqueta: "Leyenda",
        obligatorio: true,
        ayuda: "La que exige la regla 3.10.x de la RMF. Ya viene escrita; cámbiala solo si tu caso lo pide.",
      },
    ],
    porDefecto: {
      noAutorizacion: "",
      fechaAutorizacion: "",
      leyenda:
        "Este comprobante ampara un donativo, el cual será destinado por la donataria a los fines propios de su objeto social. En el caso de que los bienes donados hayan sido deducidos previamente para los efectos del impuesto sobre la renta, este donativo no es deducible.",
    },
    aJson: (d) => ({
      version: "1.1",
      noAutorizacion: t(d.noAutorizacion),
      fechaAutorizacion: t(d.fechaAutorizacion),
      leyenda: t(d.leyenda),
    }),
  },
  {
    id: "divisas",
    nombre: "Compra venta de divisas",
    descripcion: "Casas de cambio: si la operación es compra o venta.",
    disponible: true,
    destino: "comprobante",
    nodo: "Divisas",
    campos: [
      {
        id: "tipoOperacion",
        etiqueta: "Tipo de operación",
        opciones: [
          { value: "compra", label: "Compra" },
          { value: "venta", label: "Venta" },
        ],
      },
    ],
    porDefecto: { tipoOperacion: "compra" },
    aJson: (d) => ({ version: "1.0", tipoOperacion: d.tipoOperacion === "venta" ? "venta" : "compra" }),
  },
  {
    id: "pfic",
    nombre: "Persona física integrante de coordinado",
    descripcion: "Transportistas que tributan a través de un coordinado: la unidad y su RFC.",
    disponible: true,
    destino: "comprobante",
    nodo: "PFintegranteCoordinado",
    campos: [
      { id: "ClaveVehicular", etiqueta: "Clave vehicular", obligatorio: true, mayusculas: true },
      { id: "Placa", etiqueta: "Placa", obligatorio: true, mayusculas: true },
      { id: "RFCPF", etiqueta: "RFC de la persona física", mayusculas: true, placeholder: "Solo si no es el emisor" },
    ],
    porDefecto: { ClaveVehicular: "", Placa: "", RFCPF: "" },
    revisar: (d) => patron(d, "RFCPF", RFC, "El RFC no tiene el formato correcto."),
    aJson: (d) => ({
      version: "1.0",
      ...sinVacios({ ClaveVehicular: T(d.ClaveVehicular), Placa: T(d.Placa), RFCPF: T(d.RFCPF) }),
    }),
  },
  {
    id: "pagoenespecie",
    nombre: "Pago en especie",
    descripcion: "Pago de contribuciones con obras de artes plásticas y antigüedades.",
    disponible: true,
    destino: "comprobante",
    nodo: "PagoEnEspecie",
    campos: [
      {
        id: "CvePIC",
        etiqueta: "Clave del PIC",
        obligatorio: true,
        mayusculas: true,
        placeholder: "RFC-AAAAMMDD-000",
        ayuda: "RFC del contribuyente, la fecha y el consecutivo, separados por guiones.",
      },
      { id: "FolioSolDon", etiqueta: "Folio de la solicitud de donación", obligatorio: true, mayusculas: true, placeholder: "PE-00-00000" },
      { id: "PzaArtNombre", etiqueta: "Nombre de la obra", obligatorio: true },
      { id: "PzaArtTecn", etiqueta: "Técnica de producción", obligatorio: true },
      { id: "PzaArtAProd", etiqueta: "Año de producción", obligatorio: true, numerico: true, placeholder: "AAAA" },
      { id: "PzaArtDim", etiqueta: "Dimensiones", obligatorio: true, placeholder: "Ej. 120 x 80 cm" },
    ],
    porDefecto: { CvePIC: "", FolioSolDon: "", PzaArtNombre: "", PzaArtTecn: "", PzaArtAProd: "", PzaArtDim: "" },
    revisar: (d) => [
      ...patron(
        d,
        "CvePIC",
        /^[A-ZÑ&]{3}\d{2}[01]\d[0-3]\d[A-Z0-9]?[A-Z0-9]?[0-9A-Z]-(18|19|20)\d\d(0[1-9]|1[012])(0[1-9]|[12]\d|3[01])-\d{3}$/,
        "La clave del PIC no tiene el formato del SAT (RFC-AAAAMMDD-000)."
      ),
      ...patron(d, "FolioSolDon", /^PE-\d{2}-\d{5}$/, "El folio debe verse como PE-00-00000."),
      ...patron(d, "PzaArtAProd", /^\d{4}$/, "El año son cuatro dígitos."),
    ],
    aJson: (d) => ({
      Version: "1.0",
      CvePIC: T(d.CvePIC),
      FolioSolDon: T(d.FolioSolDon),
      PzaArtNombre: t(d.PzaArtNombre),
      PzaArtTecn: t(d.PzaArtTecn),
      PzaArtAProd: t(d.PzaArtAProd),
      PzaArtDim: t(d.PzaArtDim),
    }),
  },
  {
    id: "obrasarte",
    nombre: "Obras de arte y antigüedades",
    descripcion: "Enajenación de obras de artes plásticas y antigüedades.",
    disponible: true,
    destino: "comprobante",
    nodo: "obrasarteantiguedades",
    desdeJson: (v) => ({
      TipoBien: s(v.TipoBien) || "01",
      OtrosTipoBien: s(v.OtrosTipoBien),
      TituloAdquirido: s(v.TituloAdquirido) || "01",
      OtrosTituloAdquirido: s(v.OtrosTituloAdquirido),
      FechaAdquisicion: s(v.FechaAdquisicion),
      Caracteristicas: s(v["CaracterísticasDeObraoPieza"]) || "01",
      Subtotal: s(v.Subtotal),
      IVA: s(v.IVA),
    }),
    campos: [
      {
        id: "TipoBien",
        etiqueta: "Tipo de bien",
        opciones: [
          { value: "01", label: "01 - Pinturas" },
          { value: "02", label: "02 - Grabados" },
          { value: "03", label: "03 - Esculturas" },
          { value: "04", label: "04 - Otros" },
        ],
      },
      { id: "OtrosTipoBien", etiqueta: "Cuál otro tipo de bien", ayuda: "Solo si el tipo de bien es «Otros»." },
      {
        id: "TituloAdquirido",
        etiqueta: "Cómo se adquirió",
        opciones: [
          { value: "01", label: "01 - Compra" },
          { value: "02", label: "02 - Donación" },
          { value: "03", label: "03 - Herencia" },
          { value: "04", label: "04 - Legado" },
          { value: "05", label: "05 - Otros" },
        ],
      },
      { id: "OtrosTituloAdquirido", etiqueta: "Cuál otro título", ayuda: "Solo si se adquirió por «Otros»." },
      { id: "FechaAdquisicion", etiqueta: "Fecha de adquisición", obligatorio: true, tipo: "fecha" },
      {
        id: "Caracteristicas",
        etiqueta: "Características de la obra",
        opciones: [
          { value: "01", label: "01 - Firmadas" },
          { value: "02", label: "02 - Fechadas" },
          { value: "03", label: "03 - Enmarcadas" },
          { value: "04", label: "04 - Armelladas" },
          { value: "05", label: "05 - Alambradas" },
          { value: "06", label: "06 - Número de serie" },
          { value: "07", label: "07 - Dos o más de las anteriores" },
        ],
      },
      { id: "Subtotal", etiqueta: "Subtotal de la adquisición", numerico: true },
      { id: "IVA", etiqueta: "IVA de la adquisición", numerico: true },
    ],
    porDefecto: {
      TipoBien: "01",
      OtrosTipoBien: "",
      TituloAdquirido: "01",
      OtrosTituloAdquirido: "",
      FechaAdquisicion: "",
      Caracteristicas: "01",
      Subtotal: "",
      IVA: "",
    },
    revisar: (d) => [
      // En el escritorio esta segunda regla preguntaba por TipoBien en vez de
      // TituloAdquirido; aquí cada "Otros" pide su propio texto.
      ...(d.TipoBien === "04" && !t(d.OtrosTipoBien)
        ? [{ campo: "OtrosTipoBien", mensaje: "Con tipo de bien «Otros» hay que decir cuál." }]
        : []),
      ...(d.TituloAdquirido === "05" && !t(d.OtrosTituloAdquirido)
        ? [{ campo: "OtrosTituloAdquirido", mensaje: "Con título «Otros» hay que decir cuál." }]
        : []),
      ...monto(d, "Subtotal", "El subtotal"),
      ...monto(d, "IVA", "El IVA"),
    ],
    aJson: (d) => ({
      Version: "1.0",
      ...sinVacios({
        TipoBien: d.TipoBien,
        OtrosTipoBien: d.TipoBien === "04" ? t(d.OtrosTipoBien) : "",
        TituloAdquirido: d.TituloAdquirido,
        OtrosTituloAdquirido: d.TituloAdquirido === "05" ? t(d.OtrosTituloAdquirido) : "",
        Subtotal: importe(d.Subtotal),
        IVA: importe(d.IVA),
        FechaAdquisicion: t(d.FechaAdquisicion),
        CaracterísticasDeObraoPieza: d.Caracteristicas,
      }),
    }),
  },
  {
    id: "vehiculousado",
    nombre: "Vehículo usado",
    descripcion: "Venta de un vehículo usado a una agencia: montos y datos del vehículo.",
    disponible: true,
    destino: "comprobante",
    nodo: "VehiculoUsado",
    desdeJson: (v) => {
      const a = hijo(v.InformacionAduanera);
      return {
        montoAdquisicion: s(v.montoAdquisicion),
        montoEnajenacion: s(v.montoEnajenacion),
        valor: s(v.valor),
        claveVehicular: s(v.claveVehicular),
        marca: s(v.marca),
        tipo: s(v.tipo),
        modelo: s(v.modelo),
        NIV: s(v.NIV),
        numeroSerie: s(v.numeroSerie),
        numeroMotor: s(v.numeroMotor),
        numeroPedimento: s(a.numero),
        fechaPedimento: s(a.fecha),
        aduana: s(a.aduana),
      };
    },
    campos: [
      { id: "montoAdquisicion", etiqueta: "Monto de adquisición", obligatorio: true, numerico: true },
      { id: "montoEnajenacion", etiqueta: "Monto de enajenación", obligatorio: true, numerico: true },
      { id: "valor", etiqueta: "Valor según la guía EBC o autométrica", obligatorio: true, numerico: true },
      { id: "claveVehicular", etiqueta: "Clave vehicular", obligatorio: true, mayusculas: true, placeholder: "Hasta 7 caracteres" },
      { id: "marca", etiqueta: "Marca", obligatorio: true },
      { id: "tipo", etiqueta: "Tipo o versión", obligatorio: true },
      { id: "modelo", etiqueta: "Modelo (año)", obligatorio: true, numerico: true, placeholder: "AAAA" },
      { id: "NIV", etiqueta: "NIV", mayusculas: true },
      { id: "numeroSerie", etiqueta: "Número de serie", mayusculas: true },
      { id: "numeroMotor", etiqueta: "Número de motor", mayusculas: true },
      { id: "numeroPedimento", etiqueta: "Pedimento de importación", ayuda: "Solo si el vehículo es importado." },
      { id: "fechaPedimento", etiqueta: "Fecha del pedimento", tipo: "fecha" },
      { id: "aduana", etiqueta: "Aduana" },
    ],
    porDefecto: {
      montoAdquisicion: "",
      montoEnajenacion: "",
      valor: "",
      claveVehicular: "",
      marca: "",
      tipo: "",
      modelo: "",
      NIV: "",
      numeroSerie: "",
      numeroMotor: "",
      numeroPedimento: "",
      fechaPedimento: "",
      aduana: "",
    },
    revisar: (d) => [
      ...monto(d, "montoAdquisicion", "El monto de adquisición"),
      ...monto(d, "montoEnajenacion", "El monto de enajenación"),
      ...monto(d, "valor", "El valor"),
      ...patron(d, "modelo", /^\d{4}$/, "El modelo es el año, cuatro dígitos."),
      ...(t(d.claveVehicular).length > 7 ? [{ campo: "claveVehicular", mensaje: "La clave vehicular es de hasta 7 caracteres." }] : []),
      ...(t(d.numeroPedimento) && !t(d.fechaPedimento)
        ? [{ campo: "fechaPedimento", mensaje: "Con pedimento hay que poner su fecha." }]
        : []),
    ],
    aJson: (d) => ({
      Version: "1.0",
      ...sinVacios({
        montoAdquisicion: importe(d.montoAdquisicion),
        montoEnajenacion: importe(d.montoEnajenacion),
        claveVehicular: T(d.claveVehicular),
        marca: t(d.marca),
        tipo: t(d.tipo),
        modelo: t(d.modelo),
        numeroMotor: T(d.numeroMotor),
        numeroSerie: T(d.numeroSerie),
        NIV: T(d.NIV),
        valor: importe(d.valor),
      }),
      ...(t(d.numeroPedimento)
        ? {
            InformacionAduanera: [
              sinVacios({ numero: t(d.numeroPedimento), fecha: t(d.fechaPedimento), aduana: t(d.aduana) }),
            ],
          }
        : {}),
    }),
  },
  {
    id: "tpe",
    nombre: "Turista pasajero extranjero",
    descripcion: "Servicios a turistas extranjeros: su tránsito y su identificación.",
    disponible: true,
    destino: "comprobante",
    nodo: "TuristaPasajeroExtranjero",
    desdeJson: (v) => {
      const d = hijo(v.datosTransito);
      return {
        fechadeTransito: s(v.fechadeTransito).slice(0, 16),
        tipoTransito: s(v.tipoTransito) || "Arribo",
        Via: s(d.Via) || "Aérea",
        TipoId: s(d.TipoId),
        NumeroId: s(d.NumeroId),
        Nacionalidad: s(d.Nacionalidad),
        EmpresaTransporte: s(d.EmpresaTransporte),
        IdTransporte: s(d.IdTransporte),
      };
    },
    campos: [
      { id: "fechadeTransito", etiqueta: "Fecha y hora del tránsito", obligatorio: true, tipo: "fechaHora" },
      {
        id: "tipoTransito",
        etiqueta: "Tipo de tránsito",
        opciones: [
          { value: "Arribo", label: "Arribo" },
          { value: "Salida", label: "Salida" },
        ],
      },
      {
        id: "Via",
        etiqueta: "Vía",
        opciones: [
          { value: "Aérea", label: "Aérea" },
          { value: "Marítima", label: "Marítima" },
          { value: "Terrestre", label: "Terrestre" },
        ],
      },
      { id: "TipoId", etiqueta: "Tipo de identificación", obligatorio: true, placeholder: "Ej. Pasaporte" },
      { id: "NumeroId", etiqueta: "Número de identificación", obligatorio: true },
      { id: "Nacionalidad", etiqueta: "Nacionalidad", obligatorio: true },
      { id: "EmpresaTransporte", etiqueta: "Empresa de transporte", obligatorio: true },
      { id: "IdTransporte", etiqueta: "Vuelo, viaje o transporte" },
    ],
    porDefecto: {
      fechadeTransito: "",
      tipoTransito: "Arribo",
      Via: "Aérea",
      TipoId: "",
      NumeroId: "",
      Nacionalidad: "",
      EmpresaTransporte: "",
      IdTransporte: "",
    },
    aJson: (d) => ({
      version: "1.0",
      // El selector de fecha y hora no manda segundos; xs:dateTime los pide.
      fechadeTransito: t(d.fechadeTransito).length === 16 ? `${t(d.fechadeTransito)}:00` : t(d.fechadeTransito),
      tipoTransito: d.tipoTransito,
      datosTransito: sinVacios({
        Via: d.Via,
        TipoId: t(d.TipoId),
        NumeroId: t(d.NumeroId),
        Nacionalidad: t(d.Nacionalidad),
        EmpresaTransporte: t(d.EmpresaTransporte),
        IdTransporte: t(d.IdTransporte),
      }),
    }),
  },
  {
    id: "servicioparcial",
    nombre: "Servicios parciales de construcción",
    descripcion: "Construcción de inmuebles destinados a casa habitación: licencia y domicilio de la obra.",
    disponible: true,
    destino: "comprobante",
    nodo: "parcialesconstruccion",
    campos: [
      { id: "NumPerLicoAut", etiqueta: "Número de permiso, licencia o autorización", obligatorio: true },
      { id: "Calle", etiqueta: "Calle de la obra", obligatorio: true },
      { id: "NoExterior", etiqueta: "Número exterior" },
      { id: "NoInterior", etiqueta: "Número interior" },
      { id: "Colonia", etiqueta: "Colonia" },
      { id: "Localidad", etiqueta: "Localidad" },
      { id: "Referencia", etiqueta: "Referencia" },
      { id: "Municipio", etiqueta: "Municipio o alcaldía", obligatorio: true },
      { id: "Estado", etiqueta: "Estado", opciones: ENTIDADES },
      { id: "CodigoPostal", etiqueta: "Código postal", obligatorio: true, numerico: true },
    ],
    porDefecto: {
      NumPerLicoAut: "",
      Calle: "",
      NoExterior: "",
      NoInterior: "",
      Colonia: "",
      Localidad: "",
      Referencia: "",
      Municipio: "",
      Estado: "11",
      CodigoPostal: "",
    },
    revisar: (d) => patron(d, "CodigoPostal", /^\d{5}$/, "El código postal son cinco dígitos."),
    aJson: (d) => ({
      Version: "1.0",
      NumPerLicoAut: t(d.NumPerLicoAut),
      Inmueble: sinVacios({
        Calle: t(d.Calle),
        NoExterior: t(d.NoExterior),
        NoInterior: t(d.NoInterior),
        Colonia: t(d.Colonia),
        Localidad: t(d.Localidad),
        Referencia: t(d.Referencia),
        Municipio: t(d.Municipio),
        Estado: d.Estado,
        CodigoPostal: t(d.CodigoPostal),
      }),
    }),
  },
  {
    id: "destruccion",
    nombre: "Certificado de destrucción",
    descripcion: "Centros de destrucción de vehículos: el certificado y el vehículo destruido.",
    disponible: true,
    destino: "comprobante",
    nodo: "certificadodedestruccion",
    desdeJson: (v) => {
      const h = hijo(v.VehiculoDestruido);
      const a = hijo(v.InformacionAduanera);
      return {
        Serie: s(v.Serie) || "SERIE A",
        NumFolDesVeh: s(v.NumFolDesVeh),
        Marca: s(h.Marca),
        TipooClase: s(h.TipooClase),
        Anio: s(h["Año"]),
        Modelo: s(h.Modelo),
        NumPlacas: s(h.NumPlacas),
        NumFolTarjCir: s(h.NumFolTarjCir),
        NIV: s(h.NIV),
        NumSerie: s(h.NumSerie),
        NumMotor: s(h.NumMotor),
        NumPedImp: s(a.NumPedImp),
        FechaPedimento: s(a.Fecha),
        Aduana: s(a.Aduana),
      };
    },
    campos: [
      {
        id: "Serie",
        etiqueta: "Serie del certificado",
        opciones: [
          { value: "SERIE A", label: "Serie A - Personas físicas no permisionarias de más de 5 unidades" },
          { value: "SERIE B", label: "Serie B - Personas físicas permisionarias de más de 5 unidades" },
          { value: "SERIE C", label: "Serie C - Personas morales del autotransporte federal" },
          { value: "SERIE D", label: "Serie D - Servicio público urbano o suburbano" },
          { value: "SERIE E", label: "Serie E - Importación definitiva sin formalidades aduaneras" },
        ],
      },
      { id: "NumFolDesVeh", etiqueta: "Folio del certificado", obligatorio: true },
      { id: "Marca", etiqueta: "Marca", obligatorio: true },
      { id: "TipooClase", etiqueta: "Tipo o clase", obligatorio: true },
      { id: "Anio", etiqueta: "Año", obligatorio: true, numerico: true, placeholder: "AAAA" },
      { id: "Modelo", etiqueta: "Modelo" },
      { id: "NumPlacas", etiqueta: "Placas", obligatorio: true, mayusculas: true },
      { id: "NumFolTarjCir", etiqueta: "Folio de la tarjeta de circulación", obligatorio: true },
      { id: "NIV", etiqueta: "NIV", mayusculas: true },
      { id: "NumSerie", etiqueta: "Número de serie", mayusculas: true },
      { id: "NumMotor", etiqueta: "Número de motor", mayusculas: true },
      { id: "NumPedImp", etiqueta: "Pedimento de importación", ayuda: "Solo si el vehículo es importado." },
      { id: "FechaPedimento", etiqueta: "Fecha del pedimento", tipo: "fecha" },
      { id: "Aduana", etiqueta: "Aduana" },
    ],
    porDefecto: {
      Serie: "SERIE A",
      NumFolDesVeh: "",
      Marca: "",
      TipooClase: "",
      Anio: "",
      Modelo: "",
      NumPlacas: "",
      NumFolTarjCir: "",
      NIV: "",
      NumSerie: "",
      NumMotor: "",
      NumPedImp: "",
      FechaPedimento: "",
      Aduana: "",
    },
    revisar: (d) => {
      const p = [...patron(d, "Anio", /^(19|20)\d{2}$/, "El año son cuatro dígitos, de 1900 en adelante.")];
      // La información aduanera va completa o no va: el XSD pide los tres.
      const aduana = [t(d.NumPedImp), t(d.FechaPedimento), t(d.Aduana)];
      if (aduana.some(Boolean) && !aduana.every(Boolean)) {
        p.push({ campo: "NumPedImp", mensaje: "Para un vehículo importado van el pedimento, su fecha y la aduana." });
      }
      return p;
    },
    // VehiculoDestruido antes que InformacionAduanera: es el orden del XSD.
    aJson: (d) => ({
      Version: "1.0",
      Serie: d.Serie,
      NumFolDesVeh: t(d.NumFolDesVeh),
      VehiculoDestruido: sinVacios({
        Marca: t(d.Marca),
        TipooClase: t(d.TipooClase),
        Año: t(d.Anio),
        Modelo: t(d.Modelo),
        NIV: T(d.NIV),
        NumSerie: T(d.NumSerie),
        NumPlacas: T(d.NumPlacas),
        NumMotor: T(d.NumMotor),
        NumFolTarjCir: t(d.NumFolTarjCir),
      }),
      ...(t(d.NumPedImp)
        ? { InformacionAduanera: { NumPedImp: t(d.NumPedImp), Fecha: t(d.FechaPedimento), Aduana: t(d.Aduana) } }
        : {}),
    }),
  },
  {
    id: "hyp",
    nombre: "Hidrocarburos y petrolíferos",
    descripcion: "Venta de gasolina o diésel: permiso de la CRE y el producto.",
    disponible: true,
    destino: "concepto",
    nodo: "HidroYPetro",
    campos: [
      {
        id: "TipoPermiso",
        etiqueta: "Tipo de permiso",
        opciones: [
          { value: "PER01", label: "PER01 - Expendio en estaciones de servicio" },
          { value: "PER02", label: "PER02 - Comercialización" },
          { value: "PER03", label: "PER03 - Distribución por medios distintos a ducto" },
          { value: "PER04", label: "PER04 - Expendio en estaciones multimodales" },
          { value: "PER05", label: "PER05 - Expendio en estaciones de servicio (CNE)" },
          { value: "PER06", label: "PER06 - Comercialización (CNE)" },
          { value: "PER07", label: "PER07 - Distribución por medios distintos a ducto (CNE)" },
          { value: "PER08", label: "PER08 - Expendio en estaciones multimodales (CNE)" },
          { value: "PER09", label: "PER09 - Comercialización de petrolíferos (CNE)" },
          { value: "PER10", label: "PER10 - Comercialización (otros)" },
          { value: "PER11", label: "PER11 - Comercialización (F00.07.UH)" },
        ],
      },
      {
        id: "NumeroPermiso",
        etiqueta: "Número de permiso",
        obligatorio: true,
        placeholder: "Ej. PL/12345/EXP/ES/2016",
        ayuda: "Tal como aparece en el permiso de la CRE.",
      },
      {
        id: "ClaveHYP",
        etiqueta: "Producto",
        opciones: [
          { value: "15101514", label: "15101514 - Gasolina regular menor a 91 octanos" },
          { value: "15101515", label: "15101515 - Gasolina premium de 91 octanos o más" },
          { value: "15101505", label: "15101505 - Combustible diésel" },
        ],
      },
      {
        id: "SubProductoHYP",
        etiqueta: "Subproducto",
        opciones: [
          { value: "SP16", label: "SP16 - Gasolina regular menor a 91 octanos" },
          { value: "SP17", label: "SP17 - Gasolina premium de 91 octanos o más" },
          { value: "SP18", label: "SP18 - Diésel automotriz" },
          { value: "SP19", label: "SP19 - Diésel marino" },
          { value: "SP22", label: "SP22 - IFO380" },
          { value: "SP23", label: "SP23 - Diésel industrial" },
          { value: "SP24", label: "SP24 - Diésel de ultra bajo azufre (DUBA)" },
          { value: "SP25", label: "SP25 - Diésel agrícola" },
          { value: "SP48", label: "SP48 - Gasóleo doméstico" },
        ],
      },
    ],
    porDefecto: { TipoPermiso: "PER01", NumeroPermiso: "", ClaveHYP: "15101514", SubProductoHYP: "SP16" },
    revisar: (d) => {
      const p: ProblemaComplemento[] = [];
      const n = t(d.NumeroPermiso).length;
      if (n > 0 && (n < 15 || n > 35)) {
        p.push({ campo: "NumeroPermiso", mensaje: "El número de permiso tiene de 15 a 35 caracteres." });
      }
      // El subproducto tiene que ser de la familia del producto (catálogo c_ClaveHYP).
      const validos: Record<string, string[]> = {
        "15101514": ["SP16"],
        "15101515": ["SP17"],
        "15101505": ["SP18", "SP19", "SP22", "SP23", "SP24", "SP25", "SP48"],
      };
      if (!(validos[d.ClaveHYP] ?? []).includes(d.SubProductoHYP)) {
        p.push({ campo: "SubProductoHYP", mensaje: "El subproducto no corresponde al producto elegido." });
      }
      return p;
    },
    aJson: (d) => ({
      Version: "1.0",
      TipoPermiso: d.TipoPermiso,
      NumeroPermiso: t(d.NumeroPermiso),
      ClaveHYP: d.ClaveHYP,
      SubProductoHYP: d.SubProductoHYP,
    }),
  },
];
