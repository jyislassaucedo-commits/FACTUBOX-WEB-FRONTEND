"use client";

import { useState } from "react";

export function CsdSection({
  rfc,
  token,
  vigenciaActual,
  tieneCsd,
  onUploaded,
}: {
  rfc: string;
  token: string;
  vigenciaActual: string;
  // El backend deja VigenciaCert con la fecha de alta del emisor aunque
  // nunca se haya subido un CSD real - InicioCert ("NA" si no hay archivo
  // en disco) es la unica senal confiable de si ya existe un certificado.
  tieneCsd: boolean;
  onUploaded: (vigencia: string) => void;
}) {
  const [csdFile, setCsdFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!csdFile || !keyFile || !pass) {
      setError("Selecciona el .cer, el .key y escribe la contraseña.");
      return;
    }

    setSaving(true);
    try {
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

      setSuccess(`Certificado válido hasta ${body.VigenciaCertificados}`);
      setPass("");
      setCsdFile(null);
      setKeyFile(null);
      onUploaded(body.VigenciaCertificados);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">
        Certificado de sello digital (CSD)
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        {tieneCsd
          ? `Vigente hasta ${vigenciaActual}.`
          : "Este emisor todavía no tiene un certificado cargado."}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Archivo .cer
            </label>
            <input
              type="file"
              accept=".cer"
              onChange={(e) => setCsdFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-neutral-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Archivo .key
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
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 sm:w-64"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {success && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
        >
          {saving ? "Subiendo..." : "Subir certificado"}
        </button>
      </form>
    </div>
  );
}
