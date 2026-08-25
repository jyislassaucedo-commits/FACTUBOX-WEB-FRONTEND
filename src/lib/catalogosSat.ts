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
