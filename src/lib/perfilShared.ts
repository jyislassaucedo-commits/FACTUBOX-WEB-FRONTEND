/* ---------------------------------------------------------------------------
   Tipos y helpers de "Mi cuenta" que se usan en CLIENTE y en SERVIDOR.
   ---------------------------------------------------------------------------
   Viven separados de lib/perfil.ts porque ese modulo importa getSession(), que
   usa next/headers y solo existe en el servidor. Mismo patron que
   configPdfShared.ts / facturasShared.ts / timbresShared.ts.
--------------------------------------------------------------------------- */

/** Que campos puede tocar esta cuenta. Lo decide el servidor, no la UI. */
export type PerfilEditable = {
  Nombre: boolean;
  Email: boolean;
  Password: boolean;
  Imagen: boolean;
  Usuario: boolean;
  Rfc: boolean;
  Sincronizar: boolean;
};

export type Perfil = {
  EsSubusuario: "SI" | "NO";
  IdCuenta: number;
  IdTitular: number;

  Nombre: string;
  Email: string;
  /** Identificador con el que entra la cuenta. En subusuarios es su correo. */
  Usuario: string;
  Rfc: string;
  Tipo: string;
  Status: string;
  Fechareg: string;
  Sincronizar: string;
  Version: string;

  /** Ruta dentro del sitio PHP, p. ej. "/img/usuarios/u12-ab.jpg". */
  ImagenUrl: string | null;

  /** Solo presente cuando la cuenta es un subusuario. */
  NombreTitular?: string;

  Editable: PerfilEditable;
};

/** Errores por campo que devuelven los endpoints al validar (422). */
export type CamposConError = Record<string, string>;

/* -------------------------------------------------------------------------- */
/* Foto: ruta permitida y URL para el navegador                               */
/* -------------------------------------------------------------------------- */

/**
 * Las fotos viven en el sitio PHP, cuya URL solo existe en el servidor
 * (PHP_API_BASE_URL no es publica). En vez de exponerla o de configurar
 * remotePatterns en next.config, el navegador pide /api/cuenta/imagen y el
 * BFF trae los bytes.
 *
 * Este patron blinda lo que el proxy acepta pedir: solo nombres de archivo
 * dentro de /img/usuarios. Sin esta lista blanca el proxy seria un SSRF
 * hacia cualquier ruta del host PHP.
 */
const RUTA_IMAGEN_VALIDA = /^\/img\/usuarios\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp)$/;

export function esRutaImagenPerfil(ruta: string): boolean {
  return !ruta.includes("..") && RUTA_IMAGEN_VALIDA.test(ruta);
}

/** URL que consume el <img> del navegador. null si la cuenta no tiene foto. */
export function urlImagenPerfil(imagenUrl: string | null | undefined): string | null {
  if (!imagenUrl || !esRutaImagenPerfil(imagenUrl)) return null;
  return `/api/cuenta/imagen?src=${encodeURIComponent(imagenUrl)}`;
}

/** Iniciales de respaldo cuando no hay foto. */
export function inicialesPerfil(nombre: string, max = 2): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .filter((p) => p.length > 1)
      .slice(0, max)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
