"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Button, Card, CardBody, CardHeader, Note, useToast } from "@/components/ui";

const MAX_MB = 3;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

/**
 * Foto de perfil. Opcional: sin ella la app sigue mostrando las iniciales,
 * que es exactamente lo que hacía antes de que existiera este campo.
 */
export function FotoPerfilCard({
  nombre,
  imagenUrl,
  editable,
}: {
  nombre: string;
  imagenUrl: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Previsualización local mientras sube: el usuario ve el recorte al
  // instante en vez de un spinner sobre la foto vieja.
  const [preview, setPreview] = useState<string | null>(null);

  async function subir(file: File) {
    setError(null);

    if (!TIPOS.includes(file.type)) {
      setError("Formato no soportado. Usa JPG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`La imagen no puede pasar de ${MAX_MB} MB.`);
      return;
    }

    const urlLocal = URL.createObjectURL(file);
    setPreview(urlLocal);
    setGuardando(true);

    try {
      const form = new FormData();
      form.append("imagen", file);

      const res = await fetch("/api/cuenta/imagen", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "No se pudo subir la foto");
        setPreview(null);
        return;
      }

      toast("Foto actualizada");
      router.refresh();
    } catch {
      setError("No se pudo subir la foto");
      setPreview(null);
    } finally {
      setGuardando(false);
      URL.revokeObjectURL(urlLocal);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function quitar() {
    setError(null);
    setGuardando(true);

    try {
      const res = await fetch("/api/cuenta/imagen", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "No se pudo quitar la foto");
        return;
      }

      setPreview(null);
      toast("Foto eliminada");
      router.refresh();
    } catch {
      setError("No se pudo quitar la foto");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Foto de perfil"
        description="Opcional. Se recorta a un cuadrado y se guarda a 512 px."
      />
      <CardBody className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob local
            <img
              src={preview}
              alt=""
              className="h-24 w-24 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar src={imagenUrl} nombre={nombre} size="lg" />
          )}
          {guardando && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-[11px] font-semibold text-white">
              …
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <p className="text-[12.5px] text-ink-3">
            JPG, PNG o WEBP · máximo {MAX_MB} MB. Si no subes ninguna, se usan
            tus iniciales.
          </p>

          {editable ? (
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button
                type="button"
                variant="secondary"
                disabled={guardando}
                onClick={() => inputRef.current?.click()}
              >
                {imagenUrl ? "Cambiar foto" : "Subir foto"}
              </Button>
              {imagenUrl && (
                <Button type="button" variant="danger" disabled={guardando} onClick={quitar}>
                  Quitar
                </Button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={TIPOS.join(",")}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void subir(file);
                }}
              />
            </div>
          ) : (
            <Note tone="info">Tu cuenta no puede cambiar la foto.</Note>
          )}

          {error && <Note tone="danger">{error}</Note>}
        </div>
      </CardBody>
    </Card>
  );
}
