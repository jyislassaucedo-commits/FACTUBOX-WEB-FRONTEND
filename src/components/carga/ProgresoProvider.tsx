"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Registro central de "hay algo esperando al servidor".
 *
 * ---------------------------------------------------------------------------
 * Por que un contador y no un booleano
 * ---------------------------------------------------------------------------
 * Dos peticiones pueden solaparse: el asistente de factura pide series y
 * receptores a la vez. Con un booleano, la primera en terminar apaga el
 * indicador aunque la otra siga viva, y la pantalla vuelve a parecer congelada
 * justo cuando todavia esta trabajando. El contador solo llega a cero cuando
 * termino la ultima.
 *
 * ---------------------------------------------------------------------------
 * Los dos modos
 * ---------------------------------------------------------------------------
 *  - Normal: barra delgada arriba. No bloquea nada. Es el default, porque la
 *    inmensa mayoria de las peticiones son lecturas cortas y taparle la
 *    pantalla al usuario por 200 ms se siente peor que no avisarle.
 *  - Bloqueante: pantalla completa. Se reserva para operaciones que NO se
 *    pueden repetir ni interrumpir sin consecuencias: timbrar ante el SAT,
 *    subir un CSD, cambiar la contrasena. Ahi tapar la pantalla no es un
 *    estorbo, es lo que impide el segundo clic.
 */

export type Operacion = {
  id: number;
  mensaje: string;
  bloqueante: boolean;
};

type ProgresoContexto = {
  /** Registra una operacion. Devuelve la funcion que la da por terminada. */
  iniciar: (mensaje: string, bloqueante?: boolean) => () => void;
  operaciones: Operacion[];
};

const Contexto = createContext<ProgresoContexto | null>(null);

export function ProgresoProvider({ children }: { children: React.ReactNode }) {
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const siguienteId = useRef(0);

  const iniciar = useCallback((mensaje: string, bloqueante = false) => {
    const id = siguienteId.current++;
    setOperaciones((previas) => [...previas, { id, mensaje, bloqueante }]);

    // El terminador se cierra sobre SU id, asi que es seguro llamarlo tarde,
    // dos veces, o fuera de orden: solo puede quitar su propia operacion.
    let terminada = false;
    return () => {
      if (terminada) return;
      terminada = true;
      setOperaciones((previas) => previas.filter((op) => op.id !== id));
    };
  }, []);

  // `iniciar` es estable (useCallback sin dependencias), asi que el valor solo
  // cambia cuando cambian las operaciones. Sin esto, cada render del provider
  // volveria a renderizar toda la aplicacion.
  const valor = useMemo(() => ({ iniciar, operaciones }), [iniciar, operaciones]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useProgreso() {
  const ctx = useContext(Contexto);
  if (!ctx) {
    throw new Error("useProgreso debe usarse dentro de <ProgresoProvider>");
  }
  return ctx;
}

/**
 * La operacion bloqueante mas reciente, o null.
 *
 * Se toma la ULTIMA y no la primera a proposito: si el usuario dispara algo
 * bloqueante mientras otra cosa corre, el mensaje que le interesa es el de lo
 * que acaba de hacer.
 */
export function useOperacionBloqueante(): Operacion | null {
  const { operaciones } = useProgreso();
  const bloqueantes = operaciones.filter((op) => op.bloqueante);
  return bloqueantes.length > 0 ? bloqueantes[bloqueantes.length - 1] : null;
}
