/* Tipos y helpers puros de los catalogos de nomina.
 *
 * Separado de catalogosNomina.ts por lo mismo que catalogoSatBusquedaShared:
 * ese modulo llama a getSession(), que depende de next/headers y solo existe
 * en el servidor. Un componente cliente que importara de ahi aunque fuera un
 * helper de tres lineas se lleva por delante todo el modulo, y el build falla.
 */

/** Una entrada de cualquier catálogo del complemento de nómina: todos tienen
 *  la misma forma (clave, texto y vigencia). */
export type EntradaCatalogoNomina = {
  id: string;
  texto: string;
  /** Varios catalogos no la traen (contratos, jornadas, horas...). */
  vigencia_desde?: string;
  vigencia_hasta?: string;
  /** Solo en el catalogo de estados: su llave real es estado + pais. */
  pais?: string;
};

/** Los catorce catálogos de nómina, con el nombre del atributo del CFDI. */
export type CatalogosNomina = {
  bancos: EntradaCatalogoNomina[];
  estados: EntradaCatalogoNomina[];
  origenesRecursos: EntradaCatalogoNomina[];
  periodicidadesPagos: EntradaCatalogoNomina[];
  riesgosPuestos: EntradaCatalogoNomina[];
  tiposContratos: EntradaCatalogoNomina[];
  tiposDeducciones: EntradaCatalogoNomina[];
  tiposHoras: EntradaCatalogoNomina[];
  tiposIncapacidades: EntradaCatalogoNomina[];
  tiposJornadas: EntradaCatalogoNomina[];
  tiposNominas: EntradaCatalogoNomina[];
  tiposOtrosPagos: EntradaCatalogoNomina[];
  tiposPercepciones: EntradaCatalogoNomina[];
  tiposRegimenes: EntradaCatalogoNomina[];
};

export const CATALOGOS_NOMINA_VACIOS: CatalogosNomina = {
  bancos: [],
  estados: [],
  origenesRecursos: [],
  periodicidadesPagos: [],
  riesgosPuestos: [],
  tiposContratos: [],
  tiposDeducciones: [],
  tiposHoras: [],
  tiposIncapacidades: [],
  tiposJornadas: [],
  tiposNominas: [],
  tiposOtrosPagos: [],
  tiposPercepciones: [],
  tiposRegimenes: [],
};

/** Una clave sigue vigente si no tiene fecha de fin, o si aún no llega. */
export function vigente(entrada: EntradaCatalogoNomina, hoy = new Date()): boolean {
  const hasta = entrada.vigencia_hasta?.trim();
  if (!hasta) return true;
  return hasta >= hoy.toISOString().slice(0, 10);
}

/** Solo lo que se puede elegir hoy. Las claves vencidas se siguen mostrando en
 *  un empleado que ya las tenía, pero no se ofrecen para capturar. */
export function soloVigentes(lista: EntradaCatalogoNomina[]): EntradaCatalogoNomina[] {
  return lista.filter((e) => vigente(e));
}

/**
 * Los estados listos para un select de ClaveEntFed.
 *
 * El catalogo del SAT trae los 32 estados de Mexico junto con los de Estados
 * Unidos y Canada, mezclados en orden alfabetico: quien captura a un empleado
 * en Morelos no deberia pasar por Alabama y Alberta para llegar. Se ponen los
 * de Mexico primero y a los demas se les marca el pais, que si no "Colima" y
 * "Colorado" quedan indistinguibles.
 */
export function estadosParaSelect(
  estados: EntradaCatalogoNomina[]
): EntradaCatalogoNomina[] {
  const mexicanos = estados.filter((e) => e.pais === "MEX");
  const resto = estados
    .filter((e) => e.pais !== "MEX")
    .map((e) => ({ ...e, texto: e.texto + " (" + e.pais + ")" }));
  return [...mexicanos, ...resto];
}

/** El texto de una clave, para mostrar junto al codigo. */
export function textoDe(lista: EntradaCatalogoNomina[], id: string): string {
  return lista.find((e) => e.id === id)?.texto ?? "";
}
