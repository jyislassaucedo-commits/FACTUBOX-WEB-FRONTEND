import type { EmpleadoInput } from "./empleados";

/**
 * Comprobaciones de entrada del empleado, compartidas por la ruta de alta y la
 * de edicion.
 *
 * Van aparte por lo mismo que facturaEntrada.ts: con una copia en cada ruta
 * acaban discrepando, y que el alta acepte lo que la edicion rechaza es de los
 * errores que solo se descubren cuando ya hay datos torcidos guardados.
 *
 * Es a proposito poco exigente. Lo que el SAT si va a pedir al timbrar lo
 * devuelve el backend en Faltantes, para avisar sin impedir guardar: el
 * empleado se captura por partes y perder lo tecleado por un dato que se
 * consigue despues obliga a llevar la lista en un papel aparte.
 *
 * La fecha de ingreso es la unica excepcion y no por gusto: la columna es
 * DATETIME NOT NULL con el servidor en modo estricto, asi que no existe ningun
 * valor que signifique "todavia no se".
 */
export function revisarEntradaEmpleado(body: EmpleadoInput | null): string | null {
  if (body === null || typeof body !== "object") {
    return "Cuerpo de la peticion invalido";
  }
  if (typeof body.rfc !== "string" || body.rfc.trim() === "") {
    return "Falta el RFC del empleado";
  }
  if (typeof body.nombre !== "string" || body.nombre.trim() === "") {
    return "Falta el nombre del empleado";
  }
  if (
    typeof body.fechaInicioRelLaboral !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.fechaInicioRelLaboral.trim())
  ) {
    return "La fecha de inicio de la relacion laboral debe venir como AAAA-MM-DD";
  }
  return null;
}
