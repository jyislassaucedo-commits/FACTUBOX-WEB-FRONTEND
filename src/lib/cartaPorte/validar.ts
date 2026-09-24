/*
   Lo que impide timbrar una carta porte, por paso del asistente. Son las
   revisiones de Factubox Escritorio Carta Porte (frmMenuCartaPorte.seRelleno)
   más las que el propio flujo web necesita. Lo fino (catálogos vigentes,
   estructura) lo revisa después el validador del SAT sobre el XML armado.
*/

import { idsUbicacion, type CartaPorteBorrador } from "./borrador";

export type ProblemaCP = { campo: string; mensaje: string };

export type ProblemasCP = {
  cpGeneral: ProblemaCP[];
  cpTransporte: ProblemaCP[];
  cpFiguras: ProblemaCP[];
  cpUbicaciones: ProblemaCP[];
  cpMercancias: ProblemaCP[];
};

export const SIN_PROBLEMAS_CP: ProblemasCP = { cpGeneral: [], cpTransporte: [], cpFiguras: [], cpUbicaciones: [], cpMercancias: [] };

/** Cuántas mercancías con el mismo problema se nombran antes de resumir. */
const MAX_NOMBRADAS = 3;

function resumirFilas(nums: number[]): string {
  const vistas = nums.slice(0, MAX_NOMBRADAS).map((n) => n + 1).join(", ");
  return nums.length > MAX_NOMBRADAS ? `${vistas} y ${nums.length - MAX_NOMBRADAS} más` : vistas;
}

export function problemasCartaPorte(cp: CartaPorteBorrador): ProblemasCP {
  const p: ProblemasCP = { cpGeneral: [], cpTransporte: [], cpFiguras: [], cpUbicaciones: [], cpMercancias: [] };

  /* ---------- Datos generales ---------- */
  if (!cp.unidadPeso) p.cpGeneral.push({ campo: "unidadPeso", mensaje: "Elige la unidad de peso de la mercancía." });
  if (cp.transpInternac === "Sí") {
    if (!cp.entradaSalidaMerc) p.cpGeneral.push({ campo: "entradaSalidaMerc", mensaje: "Indica si la mercancía entra o sale del país." });
    if (!cp.paisOrigenDestino) p.cpGeneral.push({ campo: "paisOrigenDestino", mensaje: "Elige el país de origen o destino." });
    if (cp.regimenesAduaneros.length === 0) {
      p.cpGeneral.push({ campo: "regimenesAduaneros", mensaje: "El transporte internacional lleva al menos un régimen aduanero." });
    }
  }
  if (cp.registroISTMO && (!cp.ubicacionPoloOrigen || !cp.ubicacionPoloDestino)) {
    p.cpGeneral.push({ campo: "registroISTMO", mensaje: "Con registro ISTMO elige el polo de origen y el de destino." });
  }

  /* ---------- Transporte ---------- */
  const t = cp.transporte;
  if (!t) {
    p.cpTransporte.push({ campo: "transporte", mensaje: "Elige en qué se mueve la mercancía." });
  } else if (t.tipotransporte !== cp.medio) {
    p.cpTransporte.push({ campo: "transporte", mensaje: "El transporte elegido es de otro medio." });
  } else if (cp.medio === "01") {
    const a = t.autotransporte;
    if (!a) p.cpTransporte.push({ campo: "transporte", mensaje: "Al autotransporte le faltan los datos del vehículo." });
    else {
      if (!(Number(a.Pesobrutovehicular) > 0)) {
        p.cpTransporte.push({ campo: "Pesobrutovehicular", mensaje: "Falta el peso bruto vehicular de la unidad (en su ficha del catálogo)." });
      }
      if (!t.permsct || !t.numpermisosct) p.cpTransporte.push({ campo: "permsct", mensaje: "La unidad no tiene permiso SCT." });
      if (!a.asegurarespcivil || !a.polizarespcivil) {
        p.cpTransporte.push({ campo: "seguro", mensaje: "La unidad no tiene seguro de responsabilidad civil." });
      }
    }
  } else if (cp.medio === "02" && !t.maritimo) {
    p.cpTransporte.push({ campo: "transporte", mensaje: "Al transporte marítimo le faltan los datos de la embarcación." });
  } else if (cp.medio === "03" && !t.aereo) {
    p.cpTransporte.push({ campo: "transporte", mensaje: "Al transporte aéreo le faltan los datos de la aeronave." });
  } else if (cp.medio === "04" && !t.ferroviario) {
    p.cpTransporte.push({ campo: "transporte", mensaje: "Al transporte ferroviario le faltan los carros." });
  }

  /* ---------- Figuras ---------- */
  if (cp.figuras.length === 0) {
    p.cpFiguras.push({ campo: "figuras", mensaje: "Agrega al menos una figura de transporte." });
  } else if (cp.medio === "01" && !cp.figuras.some((f) => f.tipofigura === "01")) {
    p.cpFiguras.push({ campo: "figuras", mensaje: "En autotransporte va al menos un operador (figura 01)." });
  }
  const rfcsFiguras = cp.figuras.map((f) => `${f.tipofigura}|${f.rfc || f.numregidtrib}`);
  if (new Set(rfcsFiguras).size !== rfcsFiguras.length) {
    p.cpFiguras.push({ campo: "figuras", mensaje: "Hay una figura repetida." });
  }

  /* ---------- Ubicaciones ---------- */
  const u = cp.ubicaciones;
  const origenes = u.filter((x) => x.tipoUbicacion === "Origen");
  const destinos = u.filter((x) => x.tipoUbicacion === "Destino");
  if (origenes.length === 0) p.cpUbicaciones.push({ campo: "ubicaciones", mensaje: "Agrega el origen del viaje." });
  if (destinos.length === 0) p.cpUbicaciones.push({ campo: "ubicaciones", mensaje: "Agrega al menos un destino." });
  if (u.length > 0 && u[0].tipoUbicacion !== "Origen") {
    p.cpUbicaciones.push({ campo: "ubicaciones", mensaje: "El viaje empieza en un origen: mueve el origen al principio." });
  }
  const conDistancia = cp.medio === "01" || cp.medio === "04";
  u.forEach((x, i) => {
    const nombre = x.nombreremdest || `la parada ${i + 1}`;
    if (!x.fechaHora) p.cpUbicaciones.push({ campo: `ubicacion.${x.clave}.fechaHora`, mensaje: `Falta la fecha y hora de ${x.tipoUbicacion === "Origen" ? "salida de" : "llegada a"} ${nombre}.` });
    if (x.tipoUbicacion === "Destino" && conDistancia && !(Number(x.distancia) > 0)) {
      p.cpUbicaciones.push({ campo: `ubicacion.${x.clave}.distancia`, mensaje: `Falta la distancia recorrida hasta ${nombre}.` });
    }
  });
  for (let i = 1; i < u.length; i++) {
    if (u[i].fechaHora && u[i - 1].fechaHora && u[i].fechaHora < u[i - 1].fechaHora) {
      p.cpUbicaciones.push({ campo: `ubicacion.${u[i].clave}.fechaHora`, mensaje: `La llegada a ${u[i].nombreremdest || "una parada"} es antes que la parada anterior.` });
    }
  }

  /* ---------- Mercancías ---------- */
  const m = cp.mercancias;
  if (m.length === 0) {
    p.cpMercancias.push({ campo: "mercancias", mensaje: "Agrega al menos una mercancía." });
  } else {
    const sinCantidad: number[] = [];
    const sinPeso: number[] = [];
    const incompletas: number[] = [];
    const sinReparto: number[] = [];
    const repartoMal: number[] = [];
    const sinDetalle: number[] = [];
    const ids = idsUbicacion(u);
    const variasParadas = origenes.length > 1 || destinos.length > 1;
    m.forEach((x, i) => {
      if (!(Number(x.cantidad) > 0)) sinCantidad.push(i);
      if (!(Number(x.pesoTotal) > 0)) sinPeso.push(i);
      if (!x.claveprodcp || !x.descripcion.trim() || !x.claveuni) incompletas.push(i);
      if (variasParadas) {
        if (x.cantidadTransporta.length === 0) sinReparto.push(i);
        else {
          const suma = x.cantidadTransporta.reduce((acc, c) => acc + (Number(c.cantidad) || 0), 0);
          const invalido = x.cantidadTransporta.some((c) => !ids.has(c.origen) || !ids.has(c.destino));
          if (invalido || Math.abs(suma - (Number(x.cantidad) || 0)) > 0.0005) repartoMal.push(i);
        }
      }
      if (cp.medio === "02" && !x.detalle) sinDetalle.push(i);
    });
    if (incompletas.length) p.cpMercancias.push({ campo: "mercancias", mensaje: `A la mercancía ${resumirFilas(incompletas)} le falta clave, descripción o unidad.` });
    if (sinCantidad.length) p.cpMercancias.push({ campo: "mercancias", mensaje: `La mercancía ${resumirFilas(sinCantidad)} no tiene cantidad.` });
    if (sinPeso.length) p.cpMercancias.push({ campo: "mercancias", mensaje: `La mercancía ${resumirFilas(sinPeso)} no tiene peso.` });
    if (sinReparto.length) {
      p.cpMercancias.push({ campo: "mercancias", mensaje: `Con varias paradas, cada mercancía dice de dónde sale y a dónde llega: falta en ${sinReparto.length === m.length ? "todas" : `la ${resumirFilas(sinReparto)}`}.` });
    }
    if (repartoMal.length) p.cpMercancias.push({ campo: "mercancias", mensaje: `El reparto por parada de la mercancía ${resumirFilas(repartoMal)} no suma su cantidad o apunta a una parada que ya no está.` });
    if (sinDetalle.length) p.cpMercancias.push({ campo: "mercancias", mensaje: `En marítimo cada mercancía lleva su detalle (pesos bruto, neto y tara): falta en la ${resumirFilas(sinDetalle)}.` });
  }

  return p;
}
