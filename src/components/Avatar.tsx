"use client";

import { useState } from "react";
import { cx } from "@/components/ui/styles";
import { inicialesPerfil, urlImagenPerfil } from "@/lib/perfilShared";

const TAMANOS = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-24 w-24 text-2xl",
} as const;

export type AvatarSize = keyof typeof TAMANOS;

/**
 * Foto de perfil con respaldo a iniciales.
 *
 * `src` es la ruta que devuelve el PHP ("/img/usuarios/..."), no una URL
 * completa: urlImagenPerfil() la convierte en la del proxy del BFF.
 *
 * Si la imagen no carga —el archivo se borró a mano, el host PHP no
 * responde— cae a las iniciales en vez de dejar el ícono roto. Se guarda
 * CUÁL url falló, no un booleano: así, al subir una foto nueva (nombre de
 * archivo distinto), se vuelve a intentar sin necesidad de un efecto que
 * resetee la bandera.
 */
export function Avatar({
  src,
  nombre,
  size = "sm",
  className,
}: {
  src: string | null | undefined;
  nombre: string;
  size?: AvatarSize;
  className?: string;
}) {
  const url = urlImagenPerfil(src);
  const [urlFallida, setUrlFallida] = useState<string | null>(null);

  const base = cx(
    "grid shrink-0 place-items-center overflow-hidden rounded-full font-bold",
    TAMANOS[size],
    className
  );

  if (!url || urlFallida === url) {
    return (
      <span className={cx(base, "bg-ink text-background")} aria-hidden>
        {inicialesPerfil(nombre)}
      </span>
    );
  }

  return (
    // next/image exigiría publicar el host PHP en remotePatterns; aquí los
    // bytes ya llegan del mismo origen vía /api/cuenta/imagen y el tamaño es
    // fijo, así que la optimización no aporta nada.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Foto de ${nombre}`}
      className={cx(base, "bg-line-2 object-cover")}
      onError={() => setUrlFallida(url)}
    />
  );
}
