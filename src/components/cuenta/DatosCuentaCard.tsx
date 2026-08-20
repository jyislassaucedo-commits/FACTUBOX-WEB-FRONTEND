"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  FieldError,
  Input,
  Note,
  Select,
  useToast,
} from "@/components/ui";
import type { CamposConError, Perfil } from "@/lib/perfilShared";

/**
 * Datos generales: nombre, RFC, nombre de acceso y sincronización.
 *
 * Qué campos se habilitan lo dice `perfil.Editable`, que viene del servidor.
 * Un subusuario solo puede tocar su nombre: el RFC y la sincronización son de
 * la cuenta titular, y su nombre de acceso es su propio correo (se cambia en
 * la tarjeta de correo, con verificación).
 */
export function DatosCuentaCard({ perfil }: { perfil: Perfil }) {
  const router = useRouter();
  const toast = useToast();

  const [nombre, setNombre] = useState(perfil.Nombre ?? "");
  const [rfc, setRfc] = useState(perfil.Rfc ?? "");
  const [usuario, setUsuario] = useState(perfil.Usuario ?? "");
  const [sincronizar, setSincronizar] = useState<"SI" | "NO">(
    perfil.Sincronizar === "SI" ? "SI" : "NO"
  );

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<CamposConError>({});

  const { Editable } = perfil;
  const esSub = perfil.EsSubusuario === "SI";

  const sucio =
    (Editable.Nombre && nombre.trim() !== (perfil.Nombre ?? "")) ||
    (Editable.Rfc && rfc.trim().toUpperCase() !== (perfil.Rfc ?? "").toUpperCase()) ||
    (Editable.Usuario && usuario.trim() !== (perfil.Usuario ?? "")) ||
    (Editable.Sincronizar && sincronizar !== (perfil.Sincronizar === "SI" ? "SI" : "NO"));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCampos({});
    setGuardando(true);

    // Solo se manda lo que cambió: el endpoint deja intacto lo que no llega.
    const cambios: Record<string, string> = {};
    if (Editable.Nombre && nombre.trim() !== perfil.Nombre) cambios.nombre = nombre.trim();
    if (Editable.Rfc && rfc.trim().toUpperCase() !== (perfil.Rfc ?? "").toUpperCase()) {
      cambios.rfc = rfc.trim().toUpperCase();
    }
    if (Editable.Usuario && usuario.trim() !== perfil.Usuario) cambios.usuario = usuario.trim();
    if (Editable.Sincronizar && sincronizar !== perfil.Sincronizar) {
      cambios.sincronizar = sincronizar;
    }

    try {
      const res = await fetch("/api/cuenta/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        setCampos(data.campos ?? {});
        return;
      }

      toast("Datos actualizados");
      router.refresh();
    } catch {
      setError("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  function descartar() {
    setNombre(perfil.Nombre ?? "");
    setRfc(perfil.Rfc ?? "");
    setUsuario(perfil.Usuario ?? "");
    setSincronizar(perfil.Sincronizar === "SI" ? "SI" : "NO");
    setError(null);
    setCampos({});
  }

  return (
    <Card>
      <CardHeader
        title="Datos generales"
        description={
          esSub
            ? "El RFC y la sincronización pertenecen a la cuenta titular; solicítalos a quien la administra."
            : "El RFC es el de la cuenta, no el de tus emisores."
        }
      />
      <form onSubmit={guardar}>
        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={!Editable.Nombre || guardando}
                maxLength={150}
                autoComplete="name"
              />
              <FieldError mensaje={campos.Nombre} />
            </Field>

            <Field
              label="RFC"
              hint={Editable.Rfc ? "12 caracteres (moral) o 13 (física)." : undefined}
            >
              <Input
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
                disabled={!Editable.Rfc || guardando}
                readOnly={!Editable.Rfc}
                maxLength={13}
                className="font-mono uppercase"
              />
              <FieldError mensaje={campos.Rfc} />
            </Field>

            <Field
              label="Nombre de acceso"
              hint={
                Editable.Usuario
                  ? "Con esto entras a Factubox. Si lo dejas igual a tu correo, se mueve solo al cambiarlo."
                  : "Es tu correo. Se cambia abajo, con verificación."
              }
            >
              <Input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                disabled={!Editable.Usuario || guardando}
                readOnly={!Editable.Usuario}
                maxLength={120}
                autoComplete="username"
              />
              <FieldError mensaje={campos.Usuario} />
            </Field>

            <Field
              label="Sincronizar"
              hint={
                Editable.Sincronizar
                  ? "Mantiene los catálogos alineados con la app de escritorio."
                  : undefined
              }
            >
              <Select
                value={sincronizar}
                onChange={(e) => setSincronizar(e.target.value === "SI" ? "SI" : "NO")}
                disabled={!Editable.Sincronizar || guardando}
              >
                <option value="SI">Sí</option>
                <option value="NO">No</option>
              </Select>
              <FieldError mensaje={campos.Sincronizar} />
            </Field>
          </div>

          {error && <Note tone="danger">{error}</Note>}
        </CardBody>

        <div className="flex items-center justify-end gap-2 border-t border-line-2 px-5 py-3">
          {sucio && (
            <Button type="button" variant="ghost" onClick={descartar} disabled={guardando}>
              Descartar
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!sucio || guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
