"use client";

import { useState } from "react";
import { useProgresoManual } from "@/components/carga/useAccionServidor";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  FieldError,
  Input,
  Note,
  useToast,
} from "@/components/ui";
import type { CamposConError } from "@/lib/perfilShared";

const MINIMO = 8;

/**
 * Cambio de contraseña.
 *
 * Al guardar, el backend revoca todas las sesiones de la cuenta y emite una
 * nueva para este navegador; el BFF la escribe en la cookie. El usuario no
 * tiene que volver a entrar aquí, pero sí en sus otros dispositivos: eso es
 * lo que hace útil cambiar la contraseña cuando sospechas que te la robaron.
 */
export function PasswordCard() {
  const toast = useToast();

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<CamposConError>({});

  const noCoincide = confirma.length > 0 && nueva !== confirma;
  const listo =
    actual.length > 0 && nueva.length >= MINIMO && nueva === confirma && !ocupado;

  const progreso = useProgresoManual();

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCampos({});
    setOcupado(true);
    // Bloqueante: este endpoint revoca TODAS las sesiones de la cuenta y emite
    // una nueva cookie. Si el usuario navega a media operacion, se queda con la
    // sesion vieja ya revocada y lo saca la aplicacion sin explicacion.
    const terminarProgreso = progreso("Cambiando tu contraseña…", true);

    try {
      const res = await fetch("/api/cuenta/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nueva }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "No se pudo cambiar la contraseña");
        setCampos(data.campos ?? {});
        return;
      }

      setActual("");
      setNueva("");
      setConfirma("");
      toast(data.mensaje ?? "Contraseña actualizada");
    } catch {
      setError("No se pudo cambiar la contraseña");
    } finally {
      terminarProgreso();
      setOcupado(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Contraseña"
        description="Al cambiarla se cierran tus sesiones en los demás dispositivos."
      />
      <form onSubmit={guardar}>
        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Contraseña actual">
              <Input
                type="password"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                disabled={ocupado}
                autoComplete="current-password"
              />
              <FieldError mensaje={campos.PasswordActual} />
            </Field>

            <Field label="Nueva contraseña" hint={`Mínimo ${MINIMO} caracteres.`}>
              <Input
                type="password"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                disabled={ocupado}
                autoComplete="new-password"
              />
              <FieldError mensaje={campos.PasswordNueva} />
            </Field>

            <Field label="Repite la nueva">
              <Input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                disabled={ocupado}
                autoComplete="new-password"
              />
              <FieldError mensaje={noCoincide ? "Las contraseñas no coinciden" : undefined} />
            </Field>
          </div>

          {error && <Note tone="danger">{error}</Note>}
        </CardBody>

        <div className="flex justify-end border-t border-line-2 px-5 py-3">
          <Button type="submit" variant="primary" disabled={!listo}>
            {ocupado ? "Guardando…" : "Cambiar contraseña"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
