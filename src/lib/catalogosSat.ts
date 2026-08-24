// Catalogo c_RegimenFiscal del SAT (vigente para CFDI 4.0), regimenes
// generales aplicables a persona fisica y moral.
export const REGIMENES_FISCALES = [
  { value: "601", label: "601 - General de Ley Personas Morales" },
  { value: "603", label: "603 - Personas Morales con Fines no Lucrativos" },
  { value: "605", label: "605 - Sueldos y Salarios e Ingresos Asimilados a Salarios" },
  { value: "606", label: "606 - Arrendamiento" },
  { value: "608", label: "608 - Demás ingresos" },
  { value: "610", label: "610 - Residentes en el Extranjero sin Establecimiento Permanente en México" },
  { value: "611", label: "611 - Ingresos por Dividendos (socios y accionistas)" },
  { value: "612", label: "612 - Personas Físicas con Actividades Empresariales y Profesionales" },
  { value: "614", label: "614 - Ingresos por intereses" },
  { value: "615", label: "615 - Régimen de los ingresos por obtención de premios" },
  { value: "616", label: "616 - Sin obligaciones fiscales" },
  { value: "620", label: "620 - Sociedades Cooperativas de Producción" },
  { value: "621", label: "621 - Incorporación Fiscal" },
  { value: "622", label: "622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { value: "623", label: "623 - Opcional para Grupos de Sociedades" },
  { value: "624", label: "624 - Coordinados" },
  { value: "625", label: "625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas" },
  { value: "626", label: "626 - Régimen Simplificado de Confianza" },
] as const;

// c_FormaPago - las mas comunes en ventas de mostrador.
export const FORMAS_PAGO = [
  { value: "01", label: "01 - Efectivo" },
  { value: "02", label: "02 - Cheque nominativo" },
  { value: "03", label: "03 - Transferencia electrónica" },
  { value: "04", label: "04 - Tarjeta de crédito" },
  { value: "28", label: "28 - Tarjeta de débito" },
  { value: "99", label: "99 - Por definir" },
] as const;

// c_Moneda - las que de verdad se usan aquí; el catálogo completo del SAT
// tiene ~170 monedas.
export const MONEDAS = [
  { value: "MXN", label: "MXN - Peso mexicano" },
  { value: "USD", label: "USD - Dólar americano" },
  { value: "EUR", label: "EUR - Euro" },
] as const;

// c_MetodoPago
export const METODOS_PAGO = [
  { value: "PUE", label: "PUE - Pago en una sola exhibición" },
  { value: "PPD", label: "PPD - Pago en parcialidades o diferido" },
] as const;

// c_ClaveUnidad - unidades mas comunes; el campo tambien acepta texto libre.
export const CLAVES_UNIDAD = [
  { value: "H87", label: "H87 - Pieza" },
  { value: "E48", label: "E48 - Unidad de servicio" },
  { value: "ACT", label: "ACT - Actividad" },
  { value: "KGM", label: "KGM - Kilogramo" },
  { value: "LTR", label: "LTR - Litro" },
  { value: "MTR", label: "MTR - Metro" },
  { value: "HUR", label: "HUR - Hora" },
] as const;

// c_UsoCFDI (CFDI 4.0) - los mas usados; el catalogo completo del SAT
// incluye ademas claves especificas de nomina/pagos que no aplican aqui.
export const USOS_CFDI = [
  { value: "G01", label: "G01 - Adquisición de mercancías" },
  { value: "G02", label: "G02 - Devoluciones, descuentos o bonificaciones" },
  { value: "G03", label: "G03 - Gastos en general" },
  { value: "I01", label: "I01 - Construcciones" },
  { value: "I02", label: "I02 - Mobiliario y equipo de oficina por inversiones" },
  { value: "I03", label: "I03 - Equipo de transporte" },
  { value: "I04", label: "I04 - Equipo de cómputo y accesorios" },
  { value: "I05", label: "I05 - Dados, troqueles, moldes, matrices y otros activos" },
  { value: "I06", label: "I06 - Comunicaciones telefónicas" },
  { value: "I07", label: "I07 - Comunicaciones satelitales" },
  { value: "I08", label: "I08 - Otra maquinaria y equipo" },
  { value: "D01", label: "D01 - Honorarios médicos, dentales y gastos hospitalarios" },
  { value: "D02", label: "D02 - Gastos médicos por incapacidad o discapacidad" },
  { value: "D03", label: "D03 - Gastos funerales" },
  { value: "D04", label: "D04 - Donativos" },
  { value: "D05", label: "D05 - Intereses reales pagados por créditos hipotecarios" },
  { value: "D06", label: "D06 - Aportaciones voluntarias al SAR" },
  { value: "D07", label: "D07 - Primas por seguros de gastos médicos" },
  { value: "D08", label: "D08 - Gastos de transportación escolar obligatoria" },
  { value: "D09", label: "D09 - Depósitos en cuentas para el ahorro, pensiones" },
  { value: "D10", label: "D10 - Pagos por servicios educativos (colegiaturas)" },
  { value: "S01", label: "S01 - Sin efectos fiscales" },
  { value: "CP01", label: "CP01 - Pagos" },
] as const;

// Receptor fijo para facturas de Publico en General (CFDI 4.0).
export const RECEPTOR_PUBLICO_GENERAL = {
  Rfc: "XAXX010101000",
  Nombre: "PUBLICO EN GENERAL",
  RegimenFiscalReceptor: "616",
  UsoCFDI: "S01",
};

// c_Impuesto
export const IMPUESTO_IVA = "002";
export const IMPUESTO_IEPS = "003";
export const IMPUESTO_ISR = "001";

export const TASAS_IVA = [
  { value: "0.160000", label: "16%" },
  { value: "0.080000", label: "8% (frontera)" },
  { value: "0.000000", label: "0%" },
  { value: "", label: "Exento" },
] as const;

// Tasas de IVA retenido más comunes (honorarios/arrendamiento a personas
// morales 10.6667%, plataformas tecnológicas 6%, autotransporte 4%).
export const TASAS_RETENCION_IVA = [
  { value: "0.106667", label: "10.6667%" },
  { value: "0.060000", label: "6%" },
  { value: "0.040000", label: "4%" },
] as const;

export const TASAS_IEPS = [
  { value: "0.080000", label: "8%" },
  { value: "0.265000", label: "26.5%" },
  { value: "0.300000", label: "30%" },
  { value: "0.530000", label: "53%" },
] as const;

// ISR en un concepto siempre es retención (honorarios 10%, arrendamiento 1.25%).
export const TASAS_RETENCION_ISR = [
  { value: "0.100000", label: "10%" },
  { value: "0.012500", label: "1.25%" },
] as const;
