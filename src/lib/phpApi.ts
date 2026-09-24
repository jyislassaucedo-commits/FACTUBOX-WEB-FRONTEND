const PHP_API_BASE_URL = process.env.PHP_API_BASE_URL;

if (!PHP_API_BASE_URL) {
  throw new Error("Falta la variable de entorno PHP_API_BASE_URL");
}

/*
   Tope de llamadas simultáneas al PHP. El servidor corre PHP con mod_fcgid y
   PHP_FCGI_CHILDREN=20: cada petición que llega mientras otra está en curso
   abre un grupo nuevo de ~21 procesos que se queda horas ocupando memoria, y el
   servidor (compartido con otros sitios) ya se quedó sin RAM por eso. No
   tenemos root para cambiarlo, así que la web no manda más de N a la vez; las
   demás esperan turno. Vive en globalThis para que las rutas de API y los
   componentes de servidor compartan la misma cola dentro del proceso.
*/
const MAX_SIMULTANEAS = Math.max(1, parseInt(process.env.PHP_API_MAX_SIMULTANEAS ?? "2", 10) || 2);

type Turnos = { activas: number; cola: Array<() => void> };
const turnos: Turnos = ((globalThis as { __phpApiTurnos?: Turnos }).__phpApiTurnos ??= { activas: 0, cola: [] });

/** Una llamada que tarda más que esto suelta su turno (sin cancelarse), para que una colgada no trabe la web. */
const TURNO_MAX_MS = 60_000;

async function conTurno<T>(fn: () => Promise<T>): Promise<T> {
  if (turnos.activas >= MAX_SIMULTANEAS) {
    await new Promise<void>((resolve) => turnos.cola.push(resolve));
  } else {
    turnos.activas++;
  }
  let suelto = false;
  const soltar = () => {
    if (suelto) return;
    suelto = true;
    clearTimeout(reloj);
    // El turno pasa directo al siguiente en la cola, sin soltarlo en medio.
    const siguiente = turnos.cola.shift();
    if (siguiente) siguiente();
    else turnos.activas--;
  };
  const reloj = setTimeout(soltar, TURNO_MAX_MS);
  try {
    return await fn();
  } finally {
    soltar();
  }
}

export type PhpResponse<T = Record<string, unknown>> =
  | ({ Error: "0" } & T)
  | { Error: "1"; DescripError: string };

export async function callPhpApi<T = Record<string, unknown>>(
  path: string,
  // Los endpoints web leen JSON: aceptan arreglos (p. ej. UUIDs), no solo texto.
  body: Record<string, unknown>
): Promise<PhpResponse<T>> {
  return conTurno(async () => {
    const res = await fetch(`${PHP_API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await res.json();
    return data as PhpResponse<T>;
  });
}

// Los endpoints legacy (no exclusivos de la web) leen $_REQUEST, que no
// entiende un body JSON crudo - necesitan form-urlencoded.
export async function callLegacyPhpApi<T = Record<string, unknown>>(
  path: string,
  body: Record<string, string>
): Promise<PhpResponse<T>> {
  return conTurno(async () => {
    const res = await fetch(`${PHP_API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      cache: "no-store",
    });

    const text = await res.text();
    try {
      return JSON.parse(text) as PhpResponse<T>;
    } catch {
      throw new Error(`Respuesta no-JSON de ${path}: ${text}`);
    }
  });
}

// Para endpoints legacy que reciben archivos ($_FILES) ademas de campos de
// texto - reenvia el FormData tal cual, sin tocarlo (fetch en Node arma el
// boundary multipart correcto solo).
export async function callLegacyPhpApiFormData<T = Record<string, unknown>>(
  path: string,
  formData: FormData
): Promise<PhpResponse<T>> {
  return conTurno(async () => {
    const res = await fetch(`${PHP_API_BASE_URL}${path}`, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });

    const data = await res.json();
    return data as PhpResponse<T>;
  });
}

// Descarga un archivo estatico del sitio PHP (hoy, las fotos de perfil).
//
// Existe para que el navegador no necesite conocer PHP_API_BASE_URL: pide
// /api/cuenta/imagen y el BFF trae los bytes. Quien llame DEBE validar la
// ruta contra una lista blanca; si no, esto es un SSRF hacia cualquier ruta
// del host PHP.
export async function fetchPhpAsset(path: string): Promise<Response> {
  return fetch(`${PHP_API_BASE_URL}${path}`, { cache: "no-store" });
}
