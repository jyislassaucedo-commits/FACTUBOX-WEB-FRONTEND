"use client";

import { useEffect, useState } from "react";
import { Button, FieldError, Input, Note } from "@/components/ui";
import { CampoPassword } from "./CampoPassword";

/**
 * "Olvidé mi contraseña" en tres pasos: correo, código de 6 dígitos y
 * contraseña nueva. Cada paso llama a /api/auth/recuperar/*, que guarda el
 * token del movimiento en una cookie httpOnly: aquí nunca se ve.
 */

type Paso = "correo" | "codigo" | "nueva" | "listo";

type ErrorApi = {
  error?: string;
  codigo?: string;
  campos?: Record<string, string>;
  intentosRestantes?: number;
  segundosRestantes?: number;
};

const MINIMO = 8;

// Después de estos errores el código ya no sirve: solo queda pedir otro.
const SIN_REMEDIO = new Set([
  "DEMASIADOS_INTENTOS",
  "TOKEN_INVALIDO",
  "TIPO_INCORRECTO",
  "YA_USADO",
  "EXPIRADO",
]);

export const TITULO =
  "text-balance text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink md:text-[40px]";
export const ENTRADA = "-mt-2 text-pretty text-[15px] text-ink-2";
const ETIQUETA = "text-xs font-semibold text-ink-2";

async function post(url: string, body: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data: data as ErrorApi & Record<string, unknown> };
  } catch {
    return {
      ok: false,
      data: { error: "No se pudo conectar con el servidor. Intenta de nuevo." } as ErrorApi &
        Record<string, unknown>,
    };
  }
}

function mmss(seg: number) {
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

/** Cuenta regresiva en segundos; 0 cuando ya se puede volver a pedir. */
function useEspera() {
  const [espera, setEspera] = useState(0);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);
  return [espera, setEspera] as const;
}

export function Recuperar({
  emailInicial,
  onVolver,
}: {
  emailInicial: string;
  onVolver: (email?: string) => void;
}) {
  const [paso, setPaso] = useState<Paso>("correo");
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [bloqueado, setBloqueado] = useState(false);
  const [espera, setEspera] = useEspera();

  function limpiarErrores() {
    setError(null);
    setCampos({});
  }

  function ir(p: Paso) {
    limpiarErrores();
    setPaso(p);
  }

  /** Pide un código; lo usan el paso 1 y "Enviar otro código". */
  async function pedirCodigo() {
    setOcupado(true);
    limpiarErrores();
    const { ok, data } = await post("/api/auth/recuperar/solicitar", { email });
    setOcupado(false);

    if (!ok) {
      if (data.segundosRestantes) {
        setEspera(data.segundosRestantes);
        setError(`Ya te mandamos un código hace poco. Puedes pedir otro en ${mmss(data.segundosRestantes)}.`);
      } else {
        setError(data.campos ? null : data.error ?? "No se pudo enviar el código");
        setCampos(data.campos ?? {});
      }
      return false;
    }

    setEspera(Number(data.esperaSegundos) || 60);
    setCodigo("");
    setBloqueado(false);
    return true;
  }

  async function enviarCorreo(e: React.FormEvent) {
    e.preventDefault();
    if (await pedirCodigo()) ir("codigo");
  }

  async function reenviar() {
    if (await pedirCodigo()) setError(null);
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (codigo.length !== 6) {
      setCampos({ Codigo: "El código tiene 6 dígitos" });
      return;
    }
    setOcupado(true);
    limpiarErrores();
    const { ok, data } = await post("/api/auth/recuperar/confirmar", { codigo });
    setOcupado(false);

    if (!ok) {
      if (data.codigo && SIN_REMEDIO.has(data.codigo)) setBloqueado(true);
      setCampos({ Codigo: data.error ?? "No se pudo verificar el código" });
      return;
    }
    setNueva("");
    setConfirma("");
    ir("nueva");
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    limpiarErrores();
    const { ok, data } = await post("/api/auth/recuperar/restablecer", { password: nueva });
    setOcupado(false);

    if (!ok) {
      if (data.campos?.PasswordNueva) {
        setCampos(data.campos);
      } else {
        setError(data.error ?? "No se pudo cambiar la contraseña");
      }
      return;
    }
    setNueva("");
    setConfirma("");
    ir("listo");
  }

  const largoOk = nueva.length >= MINIMO;
  const coincide = nueva.length > 0 && nueva === confirma;

  if (paso === "correo") {
    return (
      <form onSubmit={enviarCorreo} className="flex flex-col gap-5" noValidate>
        <BotonVolver onClick={() => onVolver(email)}>Volver a iniciar sesión</BotonVolver>
        <h1 className={TITULO}>Recupera tu contraseña</h1>
        <p className={ENTRADA}>
          Escribe el correo de tu cuenta y te mandamos un código de 6 dígitos para crear una
          contraseña nueva.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rec-email" className={ETIQUETA}>
            Correo de tu cuenta
          </label>
          <Input
            id="rec-email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="nombre@empresa.mx"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(campos.Email) || undefined}
            className="h-11"
          />
          <FieldError mensaje={campos.Email} />
        </div>
        {error && <Note tone="danger">{error}</Note>}
        <Button type="submit" variant="primary" disabled={ocupado || !email.trim()} className="h-11">
          {ocupado ? "Enviando…" : "Enviar código"}
        </Button>
      </form>
    );
  }

  if (paso === "codigo") {
    return (
      <form onSubmit={verificar} className="flex flex-col gap-5" noValidate>
        <BotonVolver onClick={() => ir("correo")}>Usar otro correo</BotonVolver>
        <h1 className={TITULO}>Escribe el código</h1>
        <p className={ENTRADA}>
          Si <b className="break-all font-semibold text-ink">{email.trim()}</b> tiene una cuenta en
          Factubox, te llegó un código de 6 dígitos. Vence en 10 minutos. Si no lo ves, busca en
          spam.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rec-codigo" className={ETIQUETA}>
            Código de verificación
          </label>
          <Input
            id="rec-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            disabled={bloqueado}
            aria-invalid={Boolean(campos.Codigo) || undefined}
            className="h-14 text-center font-mono text-2xl font-semibold tracking-[0.5em] tabular-nums"
          />
          <FieldError mensaje={campos.Codigo} />
        </div>
        {error && <Note tone="danger">{error}</Note>}
        <Button
          type="submit"
          variant="primary"
          disabled={ocupado || bloqueado || codigo.length !== 6}
          className="h-11"
        >
          {ocupado ? "Verificando…" : "Verificar código"}
        </Button>
        <Button type="button" onClick={reenviar} disabled={ocupado || espera > 0} className="h-11">
          {espera > 0 ? `Enviar otro código en ${mmss(espera)}` : "Enviar otro código"}
        </Button>
      </form>
    );
  }

  if (paso === "nueva") {
    return (
      <form onSubmit={guardar} className="flex flex-col gap-5" noValidate>
        <h1 className={TITULO}>Crea tu nueva contraseña</h1>
        <p className={ENTRADA}>
          Es para la cuenta <b className="break-all font-semibold text-ink">{email.trim()}</b>.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rec-nueva" className={ETIQUETA}>
            Nueva contraseña
          </label>
          <CampoPassword
            id="rec-nueva"
            value={nueva}
            onChange={setNueva}
            autoComplete="new-password"
            autoFocus
            invalido={Boolean(campos.PasswordNueva)}
          />
          <FieldError mensaje={campos.PasswordNueva} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rec-confirma" className={ETIQUETA}>
            Escríbela otra vez
          </label>
          <Input
            id="rec-confirma"
            type="password"
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            className="h-11"
          />
        </div>
        <ul className="-mt-1 grid gap-1 text-[13px]" aria-live="polite">
          <Regla ok={largoOk}>Al menos {MINIMO} caracteres</Regla>
          <Regla ok={coincide}>Las dos coinciden</Regla>
        </ul>
        {error && (
          <Note tone="danger">
            {error}{" "}
            <button type="button" onClick={() => ir("correo")} className="font-semibold underline">
              Pedir un código nuevo
            </button>
          </Note>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={ocupado || !largoOk || !coincide}
          className="h-11"
        >
          {ocupado ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <span className="grid size-11 place-items-center rounded-full bg-brand-050 text-brand" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <path
            d="M5 11.5l4 4 8-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h1 className={TITULO} tabIndex={-1}>
        Contraseña actualizada
      </h1>
      <p className={ENTRADA}>
        Ya puedes entrar con tu contraseña nueva. Por seguridad cerramos tu sesión en todos tus
        equipos y te mandamos un correo avisando del cambio.
      </p>
      <Button type="button" variant="primary" onClick={() => onVolver(email)} className="h-11" autoFocus>
        Iniciar sesión
      </Button>
    </div>
  );
}

function BotonVolver({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-brand -mb-1 self-start rounded text-[13.5px] font-semibold text-ink-2 transition hover:text-ink"
    >
      <span aria-hidden>← </span>
      {children}
    </button>
  );
}

function Regla({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-ok" : "text-ink-3"}`}>
      <span
        aria-hidden
        className={`size-3.5 flex-none rounded-full border-[1.5px] border-current ${ok ? "bg-current shadow-[inset_0_0_0_2.5px_var(--surface)]" : ""}`}
      />
      {children}
      <span className="sr-only">{ok ? "(cumple)" : "(falta)"}</span>
    </li>
  );
}
