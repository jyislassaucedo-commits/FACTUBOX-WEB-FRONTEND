"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, Input, Note } from "@/components/ui";
import { CampoPassword } from "@/components/login/CampoPassword";
import { PilaCfdi } from "@/components/login/PilaCfdi";
import { ENTRADA, Recuperar, TITULO } from "@/components/login/Recuperar";
import styles from "@/components/login/login.module.css";

/**
 * Inicio de sesión y "Olvidé mi contraseña".
 *
 * La pantalla va siempre en tema claro (data-theme="light" redefine los
 * tokens de globals.css para este árbol), aunque la app esté en oscuro: es la
 * puerta de entrada y se ve igual para todos.
 */
export default function LoginPage() {
  const router = useRouter();
  const [pantalla, setPantalla] = useState<"login" | "recuperar">("login");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo iniciar sesión");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  function volverDeRecuperar(email?: string) {
    if (email?.trim()) setUsuario(email.trim());
    setPassword("");
    setError(null);
    setPantalla("login");
  }

  return (
    <div
      data-theme="light"
      className="grid min-h-screen flex-1 bg-surface text-ink md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
    >
      <main className="flex flex-col justify-center px-4 pb-12 pt-8 md:px-10 md:py-12">
        <div className="mx-auto flex w-full max-w-[380px] flex-col gap-8">
          <Image
            src="/factubox-logo.png"
            alt="Factubox"
            width={4705}
            height={960}
            className="h-8 w-auto self-start"
            priority
          />

          {pantalla === "recuperar" ? (
            <Recuperar emailInicial={usuario.includes("@") ? usuario : ""} onVolver={volverDeRecuperar} />
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <h1 className={TITULO}>Inicia sesión</h1>
              <p className={ENTRADA}>Entra para emitir y consultar tus facturas.</p>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="usuario" className="text-xs font-semibold text-ink-2">
                  Usuario o correo
                </label>
                <Input
                  id="usuario"
                  type="text"
                  autoComplete="username"
                  required
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-ink-2">
                  Contraseña
                </label>
                <CampoPassword
                  id="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  invalido={Boolean(error)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPantalla("recuperar");
                  }}
                  className="focus-brand mt-1 self-end rounded text-[13px] font-semibold text-brand underline decoration-1 underline-offset-[3px] transition hover:text-brand-600"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {error && <Note tone="danger">{error}</Note>}

              <Button type="submit" variant="primary" disabled={loading} className="h-11">
                {loading ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          )}
        </div>
      </main>

      <aside
        aria-hidden
        className={`${styles.escena} order-first flex flex-col items-center justify-center gap-2 border-b border-line px-4 pb-2 pt-6 md:order-none md:border-b-0 md:border-l md:px-6 md:py-10`}
      >
        <PilaCfdi className="h-auto w-full max-w-[210px] md:max-w-[520px]" />
        <p className="hidden max-w-[420px] text-balance text-center text-[15px] text-ink-2 md:block">
          Cada comprobante que emites queda guardado y a la mano: ingresos, egresos, pagos, nómina y
          traslados.
        </p>
      </aside>
    </div>
  );
}
