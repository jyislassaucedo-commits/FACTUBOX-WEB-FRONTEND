"use client";

import { useEffect, useState } from "react";

export function CsdSection({
  rfc,
  token,
  vigenciaActual,
  onUploaded,
  onRazonSocial,
}: {
  rfc: string;
  token: string;
  vigenciaActual: string;
  onUploaded: (vigencia: string) => void;
  onRazonSocial: (razonSocial: string) => void;
}) {
  // null = todavia verificando. Fuente de verdad: existeCSDV2 (revisa los
  // archivos .cer/.key en disco directamente), no VigenciaCert (el backend
  // le pone una fecha placeholder al crear el emisor aunque no haya CSD).
  const [tieneCsd, setTieneCsd] = useState<boolean | null>(null);
  const [csdFile, setCsdFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/empresas/${encodeURIComponent(rfc)}/csd?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((body) => setTieneCsd(Boolean(body.existe)));
  }, [rfc, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);

    if (!csdFile || !keyFile || !pass) {
      setError("Selecciona el .cer, el .key y escribe la contraseña.");
      return;
    }

    setSaving(true);
    try {
      // 1) Validar estructura/password SIN persistir, para detectar de una
      // vez si el certificado corresponde a este emisor y obtener la razon
      // social para sugerir el nombre.
      const validarForm = new FormData();
      validarForm.append("pass", pass);
      validarForm.append("csd", csdFile);
      validarForm.append("key", keyFile);

      const resValidar = await fetch(
        `/api/empresas/${encodeURIComponent(rfc)}/csd/validar`,
        { method: "POST", body: validarForm }
      );
      const validado = await resValidar.json();

      if (!resValidar.ok) {
        setError(validado.error ?? "El certificado no es válido");
        return;
      }

      // validarCSDV2.php no recorta el RFC que extrae del certificado (a
      // diferencia de uploadCertificadoEmpresaV2.php, que si usa trim()) -
      // certificados CSD viejos a veces traen espacios de mas en ese campo,
      // asi que se recorta aqui para no dar un falso "no coincide".
      const rfcCertificado = (validado.Rfc ?? "").trim();
      if (rfcCertificado && rfcCertificado.toUpperCase() !== rfc.trim().toUpperCase()) {
        setError(
          `Este certificado pertenece a ${rfcCertificado}, no a ${rfc}. Sube el certificado correcto para este emisor.`
        );
        return;
      }

      if (validado.Existente === "SI") {
        setWarning(
          "Este certificado ya está registrado en otro de tus emisores. Se subirá de todas formas."
        );
      }

      // 2) Subir y persistir de verdad.
      const formData = new FormData();
      formData.append("token", token);
      formData.append("pass", pass);
      formData.append("csd", csdFile);
      formData.append("key", keyFile);

      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/csd`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo subir el certificado");
        return;
      }

      setPass("");
      setCsdFile(null);
      setKeyFile(null);
      setTieneCsd(true);
      onUploaded(body.VigenciaCertificados);
      if (body.RazonSocial) {
        onRazonSocial(body.RazonSocial);
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-neutral-900">
          Certificado de sello digital (CSD)
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div
            className={`grid grid-cols-1 gap-3 rounded-lg p-3 sm:grid-cols-2 ${
              tieneCsd ? "border-2 border-green-500 bg-green-50/40" : "border border-neutral-200"
            }`}
          >
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-neutral-600">
                Archivo .cer
                {tieneCsd && <CheckIcon />}
              </label>
              <input
                type="file"
                accept=".cer"
                onChange={(e) => setCsdFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-neutral-600"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-neutral-600">
                Archivo .key
                {tieneCsd && <CheckIcon />}
              </label>
              <input
                type="file"
                accept=".key"
                onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-neutral-600"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Contraseña de la llave privada
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={tieneCsd ? "Solo si vas a reemplazar el certificado" : ""}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 sm:w-64"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          {warning && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {warning}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            {saving
              ? "Validando y subiendo..."
              : tieneCsd
                ? "Reemplazar certificado"
                : "Subir certificado"}
          </button>
        </form>
      </div>

      <StatusBanner tieneCsd={tieneCsd} vigenciaActual={vigenciaActual} />
    </div>
  );
}

function StatusBanner({
  tieneCsd,
  vigenciaActual,
}: {
  tieneCsd: boolean | null;
  vigenciaActual: string;
}) {
  if (tieneCsd === null) {
    return (
      <p className="bg-neutral-100 px-4 py-2 text-center text-sm text-neutral-500">
        Verificando certificado...
      </p>
    );
  }

  if (tieneCsd) {
    return (
      <p className="flex items-center justify-center gap-2 bg-green-600 px-4 py-2 text-center text-sm font-medium text-white">
        <CheckIcon white />
        El CSD se encuentra cargado correctamente
        {vigenciaActual && ` · Vigente hasta ${vigenciaActual}`}
      </p>
    );
  }

  return (
    <p className="bg-neutral-100 px-4 py-2 text-center text-sm text-neutral-600">
      Este emisor todavía no tiene un certificado cargado.
    </p>
  );
}

function CheckIcon({ white }: { white?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className={white ? "text-white" : "text-green-600"}
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
