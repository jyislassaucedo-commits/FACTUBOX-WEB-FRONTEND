"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  FileDrop,
  Input,
  Note,
  Pill,
  ProgressBar,
  useToast,
} from "@/components/ui";
import { diasRestantes, formatoFecha, parseVigencia } from "@/lib/emisorNav";

/** Vigencia tipica de un CSD del SAT: 4 años. Solo para dibujar la barra. */
const VIGENCIA_TOTAL_DIAS = 4 * 365;

export function CsdSection({
  rfc,
  token,
  vigenciaActual,
  inicioCert,
  tieneCsd,
  regimen,
  lugarExp,
}: {
  rfc: string;
  token: string;
  vigenciaActual: string;
  inicioCert: string;
  tieneCsd: boolean;
  /** Se reenvian tal cual al guardar la razon social sugerida: setEmpresaV2
   *  sobrescribe el registro completo, no hace merge. */
  regimen: string;
  lugarExp: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [csdFile, setCsdFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sugerencia, setSugerencia] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dias = tieneCsd ? diasRestantes(vigenciaActual) : null;
  const inicio = parseVigencia(inicioCert);
  const fin = parseVigencia(vigenciaActual);
  const totalDias =
    inicio && fin ? Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 86_400_000)) : VIGENCIA_TOTAL_DIAS;
  const restantePct = dias === null ? 0 : Math.max(0, Math.min(100, (dias / totalDias) * 100));
  const vencido = dias !== null && dias < 0;
  const porVencer = dias !== null && dias >= 0 && dias < 30;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setSugerencia(null);

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
      if (body.RazonSocial) setSugerencia(body.RazonSocial);
      toast(tieneCsd ? "Certificado reemplazado" : "Certificado cargado");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  async function usarRazonSocial(nombre: string) {
    const res = await fetch("/api/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rfc,
        nombre,
        regimenFiscal: regimen,
        domicilioFiscal: lugarExp,
      }),
    });
    if (!res.ok) {
      toast("No se pudo actualizar la razón social", "danger");
      return;
    }
    setSugerencia(null);
    toast("Razón social actualizada");
    router.refresh();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Certificado activo"
            description="Con el CSD se sella cada CFDI. Sin uno vigente no puedes timbrar."
            action={
              tieneCsd ? (
                <Pill tone={vencido ? "danger" : porVencer ? "warn" : "ok"}>
                  ● {vencido ? "Vencido" : porVencer ? "Por vencer" : "Vigente"}
                </Pill>
              ) : (
                <Pill tone="danger">● Sin certificado</Pill>
              )
            }
          />
          <CardBody>
            {tieneCsd ? (
              <>
                <div className="mb-5">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
                    <span className="text-ink-3">Vigencia restante</span>
                    <span className="font-semibold text-ink">
                      {dias === null
                        ? "fecha no disponible"
                        : vencido
                          ? `venció el ${formatoFecha(vigenciaActual)}`
                          : `${dias} días · expira ${formatoFecha(vigenciaActual)}`}
                    </span>
                  </div>
                  <ProgressBar
                    value={restantePct}
                    tone={vencido ? "danger" : porVencer ? "warn" : "ok"}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Válido desde">
                    <Input readOnly value={inicioCert ? formatoFecha(inicioCert) : "—"} />
                  </Field>
                  <Field label="Válido hasta">
                    <Input readOnly value={formatoFecha(vigenciaActual)} />
                  </Field>
                </div>
              </>
            ) : (
              <Note tone="warn" title="Este emisor todavía no tiene certificado">
                Sube el .cer y el .key que descargaste del SAT (Certifica), junto con la
                contraseña de la llave privada.
              </Note>
            )}

            {sugerencia && (
              <div className="mt-4">
                <Note tone="info" title="El certificado indica otra razón social">
                  El CSD dice “{sugerencia}”.{" "}
                  <button
                    type="button"
                    onClick={() => usarRazonSocial(sugerencia)}
                    className="focus-brand rounded font-semibold underline"
                  >
                    Usar este nombre
                  </button>
                </Note>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={tieneCsd ? "Reemplazar certificado" : "Subir certificado"}
            description={
              tieneCsd
                ? "Solo cuando renueves tu CSD ante el SAT. El anterior deja de usarse al guardar."
                : "El .cer y el .key deben venir del mismo trámite."
            }
          />
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FileDrop
                  label="Archivo .cer"
                  hint="Certificado público"
                  accept=".cer"
                  file={csdFile}
                  done={tieneCsd}
                  onFile={setCsdFile}
                />
                <FileDrop
                  label="Archivo .key"
                  hint="Llave privada"
                  accept=".key"
                  file={keyFile}
                  done={tieneCsd}
                  onFile={setKeyFile}
                />
              </div>

              <Field
                label="Contraseña de la llave privada"
                hint="Se envía cifrada y no se muestra de nuevo."
                className="sm:max-w-sm"
              >
                <Input
                  type="password"
                  value={pass}
                  autoComplete="off"
                  onChange={(e) => setPass(e.target.value)}
                  placeholder={tieneCsd ? "Solo si vas a reemplazar el certificado" : ""}
                />
              </Field>

              {error && (
                <Note tone="danger" title="No se pudo subir">
                  {error}
                </Note>
              )}
              {warning && <Note tone="warn">{warning}</Note>}

              <Button type="submit" variant="primary" disabled={saving}>
                {saving
                  ? "Validando y subiendo..."
                  : tieneCsd
                    ? "Reemplazar certificado"
                    : "Subir certificado"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Antes de subir" />
        <CardBody className="space-y-2.5">
          <Note tone="info" title="Usa el CSD, no la e.firma">
            El archivo de e.firma (FIEL) no sirve para timbrar.
          </Note>
          <Note tone="info" title="El .cer y el .key son pareja">
            Deben provenir del mismo trámite ante el SAT.
          </Note>
          <Note tone="warn" title="Las facturas ya timbradas no cambian">
            Conservan el sello del certificado con el que se emitieron.
          </Note>
        </CardBody>
      </Card>
    </div>
  );
}
