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
  Pill,
  useToast,
} from "@/components/ui";
import type { CamposConError, Perfil } from "@/lib/perfilShared";

type Paso =
  | { fase: "reposo" }
  | { fase: "codigo"; token: string; email: string; expiraEnMinutos: number };

/**
 * Cambio de correo en dos pasos: se manda un código de 6 dígitos al correo
 * NUEVO y el cambio se aplica al confirmarlo.
 *
 * Se pide la contraseña actual porque el correo es la llave de recuperación
 * de la cuenta: sin ese requisito, una sesión robada bastaría para quedarse
 * con la cuenta entera.
 */
export function CorreoCard({ perfil }: { perfil: Perfil }) {
  const router = useRouter();
  const toast = useToast();

  const [paso, setPaso] = useState<Paso>({ fase: "reposo" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<CamposConError>({});

  const esSub = perfil.EsSubusuario === "SI";

  function limpiar() {
    setError(null);
    setCampos({});
  }

  async function solicitar(e: React.FormEvent) {
    e.preventDefault();
    limpiar();
    setOcupado(true);

    try {
      const res = await fetch("/api/cuenta/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "No se pudo enviar el código");
        setCampos(data.campos ?? {});
        return;
      }

      setPaso({
        fase: "codigo",
        token: data.token,
        email: data.email,
        expiraEnMinutos: data.expiraEnMinutos ?? 10,
      });
      // La contraseña ya no se necesita: no tiene por qué seguir en memoria.
      setPassword("");
      setCodigo("");
    } catch {
      setError("No se pudo enviar el código");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (paso.fase !== "codigo") return;
    limpiar();
    setOcupado(true);

    try {
      const res = await fetch("/api/cuenta/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: paso.token, codigo: codigo.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "No se pudo confirmar el código");
        setCampos(data.campos ?? {});
        return;
      }

      toast("Correo actualizado");
      setPaso({ fase: "reposo" });
      setEmail("");
      setCodigo("");
      router.refresh();
    } catch {
      setError("No se pudo confirmar el código");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Correo electrónico"
        description={
          esSub
            ? "Es también tu usuario para entrar. Verificamos el correo nuevo antes de aplicar el cambio."
            : "Verificamos el correo nuevo con un código antes de aplicar el cambio."
        }
        action={<Pill tone="neutral">Actual: {perfil.Email}</Pill>}
      />

      {paso.fase === "reposo" ? (
        <form onSubmit={solicitar}>
          <CardBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nuevo correo">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={ocupado}
                  autoComplete="email"
                  placeholder="nombre@empresa.com"
                />
                <FieldError mensaje={campos.EmailNuevo} />
              </Field>

              <Field label="Tu contraseña actual" hint="Para confirmar que eres tú.">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={ocupado}
                  autoComplete="current-password"
                />
                <FieldError mensaje={campos.PasswordActual} />
              </Field>
            </div>

            {error && <Note tone="danger">{error}</Note>}
          </CardBody>

          <div className="flex justify-end border-t border-line-2 px-5 py-3">
            <Button
              type="submit"
              variant="primary"
              disabled={ocupado || !email.trim() || !password}
            >
              {ocupado ? "Enviando…" : "Enviar código"}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={confirmar}>
          <CardBody className="space-y-4">
            <Note tone="info">
              Enviamos un código de 6 dígitos a <strong>{paso.email}</strong>. Vence
              en {paso.expiraEnMinutos} minutos y solo se puede usar una vez.
            </Note>

            <Field label="Código de verificación">
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={ocupado}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="max-w-[180px] text-center font-mono text-lg tracking-[0.4em]"
              />
              <FieldError mensaje={campos.Codigo} />
            </Field>

            {error && <Note tone="danger">{error}</Note>}
          </CardBody>

          <div className="flex items-center justify-end gap-2 border-t border-line-2 px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              disabled={ocupado}
              onClick={() => {
                setPaso({ fase: "reposo" });
                setCodigo("");
                limpiar();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={ocupado || codigo.length !== 6}>
              {ocupado ? "Confirmando…" : "Confirmar cambio"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
