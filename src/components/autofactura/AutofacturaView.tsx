"use client";

import { useState } from "react";
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
  Select,
} from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { aplicaPorRfc, usosCompatibles } from "@/lib/catalogoSatBusquedaShared";
import {
  formatoDinero,
  formatoFechaLarga,
  type Autofactura,
  type DatosReceptorAutofactura,
  type ErrorTimbradoAutofactura,
  type ResultadoTimbradoAutofactura,
} from "@/lib/autofacturaShared";

/**
 * La pantalla completa de /f/{codigo}, según el estado de la venta:
 *
 *   PENDIENTE  resumen de la compra + formulario del receptor -> timbra
 *   TIMBRADA   UUID y descargas (llegó aquí ya facturada, o acaba de hacerlo)
 *   EXPIRADA / CANCELADA  aviso, sin formulario
 *
 * El comprador solo captura su parte (RFC, nombre, régimen, CP, uso, correo).
 * Conceptos y montos son de solo lectura: los dejó el comercio.
 */
export function AutofacturaView({ inicial }: { inicial: Autofactura }) {
  const [auto, setAuto] = useState(inicial);
  const [resultado, setResultado] = useState<ResultadoTimbradoAutofactura | null>(null);

  if (auto.Estado === "TIMBRADA") {
    return (
      <div className="mt-6 space-y-4">
        <Timbrada auto={auto} resultado={resultado} />
        <ResumenCompra auto={auto} />
      </div>
    );
  }

  if (auto.Estado === "EXPIRADA" || auto.Estado === "CANCELADA") {
    return (
      <div className="mt-6 space-y-4">
        <Card>
          <CardBody className="space-y-2 py-8 text-center">
            <Pill tone="warn">{auto.Estado === "EXPIRADA" ? "Plazo vencido" : "Enlace cancelado"}</Pill>
            <p className="text-lg font-semibold text-ink">
              {auto.Estado === "EXPIRADA"
                ? "Ya no es posible facturar esta compra"
                : "El comercio canceló este enlace"}
            </p>
            <p className="text-sm text-ink-3">
              {auto.Estado === "EXPIRADA"
                ? `El plazo para facturar venció el ${formatoFechaLarga(auto.Expira)}. Si necesitas la factura, contacta directamente a ${auto.Emisor.Nombre}.`
                : `Si crees que es un error, contacta directamente a ${auto.Emisor.Nombre}.`}
            </p>
          </CardBody>
        </Card>
        <ResumenCompra auto={auto} />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Factura tu compra</h1>
        <p className="text-sm text-ink-3">
          Compra en <span className="font-medium text-ink">{auto.Emisor.Nombre}</span> por{" "}
          <span className="font-medium text-ink">{formatoDinero(auto.Resumen.Total, auto.Resumen.Moneda)}</span>.
          Tienes hasta el <span className="font-medium text-ink">{formatoFechaLarga(auto.Expira)}</span>.
        </p>
      </div>

      <ResumenCompra auto={auto} />

      <FormularioReceptor
        auto={auto}
        onTimbrada={(res) => {
          setResultado(res);
          setAuto({ ...auto, Estado: "TIMBRADA", UUID: res.UUID, FechaTimbrado: res.FechaTimbrado });
        }}
        onEstado={(estado) => setAuto({ ...auto, Estado: estado })}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ResumenCompra({ auto }: { auto: Autofactura }) {
  const r = auto.Resumen;
  const folio = r.Serie || r.Folio ? [r.Serie, r.Folio].filter(Boolean).join("-") : null;
  return (
    <Card>
      <CardHeader
        title="Tu compra"
        description={
          <>
            {auto.Emisor.Nombre} · RFC {auto.Emisor.Rfc}
            {auto.Referencia && <> · Ref. {auto.Referencia}</>}
            {folio && <> · Folio {folio}</>}
          </>
        }
      />
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-4">
                <th className="px-5 py-2 font-semibold">Concepto</th>
                <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                <th className="px-3 py-2 text-right font-semibold">P. unitario</th>
                <th className="px-5 py-2 text-right font-semibold">Importe</th>
              </tr>
            </thead>
            <tbody>
              {r.Conceptos.map((c, i) => (
                <tr key={i} className="border-t border-line-2">
                  <td className="px-5 py-2.5 text-ink">
                    {c.Descripcion}
                    {c.Unidad && <span className="ml-1 text-ink-4">· {c.Unidad}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{c.Cantidad}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{formatoDinero(c.ValorUnitario, "")}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink">{formatoDinero(c.Importe, "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="space-y-1 border-t border-line-2 px-5 py-3 text-[13px]">
          <Linea etiqueta="Subtotal" valor={formatoDinero(r.SubTotal, "")} />
          {parseFloat(r.Descuento || "0") > 0 && <Linea etiqueta="Descuento" valor={`- ${formatoDinero(r.Descuento, "")}`} />}
          {parseFloat(r.Impuestos || "0") > 0 && <Linea etiqueta="Impuestos" valor={formatoDinero(r.Impuestos, "")} />}
          <Linea etiqueta="Total" valor={formatoDinero(r.Total, r.Moneda)} fuerte />
        </dl>
      </CardBody>
    </Card>
  );
}

function Linea({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={fuerte ? "font-semibold text-ink" : "text-ink-3"}>{etiqueta}</dt>
      <dd className={`tabular-nums ${fuerte ? "text-base font-semibold text-ink" : "text-ink-2"}`}>{valor}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const VACIO: DatosReceptorAutofactura = {
  rfc: "",
  nombre: "",
  regimenFiscal: "",
  domicilioFiscal: "",
  usoCfdi: "",
  email: "",
};

function FormularioReceptor({
  auto,
  onTimbrada,
  onEstado,
}: {
  auto: Autofactura;
  onTimbrada: (res: ResultadoTimbradoAutofactura) => void;
  onEstado: (estado: Autofactura["Estado"]) => void;
}) {
  const [valores, setValores] = useState<DatosReceptorAutofactura>(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorTimbradoAutofactura | null>(null);

  const regimenes = auto.Catalogos?.RegimenFiscal ?? [];
  const usos = auto.Catalogos?.UsoCfdi ?? [];
  const regimenesParaRfc = aplicaPorRfc(regimenes, valores.rfc);
  const usosParaRegimen = usosCompatibles(usos, valores.regimenFiscal);
  const campos = error?.campos ?? {};

  function cambiar<K extends keyof DatosReceptorAutofactura>(campo: K, valor: DatosReceptorAutofactura[K]) {
    // El error de ese campo ya no describe lo que hay: se quita al editar.
    setError((e) => {
      if (!e?.campos?.[campo]) return e;
      const campos = { ...e.campos };
      delete campos[campo];
      // Sin campos marcados, el aviso "revisa los datos" ya no tiene sentido.
      return Object.keys(campos).length > 0 ? { ...e, campos } : null;
    });
    setValores((v) => {
      const siguiente = { ...v, [campo]: valor };
      // Al cambiar el régimen, el uso elegido puede dejar de ser válido.
      if (campo === "regimenFiscal" && !usosCompatibles(usos, String(valor)).some((u) => u.id === v.usoCfdi)) {
        siguiente.usoCfdi = "";
      }
      // Y al cambiar de persona física a moral (o al revés), el régimen.
      if (campo === "rfc" && !aplicaPorRfc(regimenes, String(valor)).some((r) => r.id === v.regimenFiscal)) {
        siguiente.regimenFiscal = "";
        siguiente.usoCfdi = "";
      }
      return siguiente;
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch(`/api/publico/autofactura/${auto.Codigo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        const err: ErrorTimbradoAutofactura = body ?? { error: "No se pudo conectar con el servidor" };
        // Si otro envío ya la timbró, o el comercio la canceló mientras
        // tanto, la pantalla cambia de estado en vez de quedarse en el error.
        if (err.estado && err.estado !== "PENDIENTE") {
          onEstado(err.estado);
          return;
        }
        setError(err);
        return;
      }
      onTimbrada(body as ResultadoTimbradoAutofactura);
    } catch {
      setError({ error: "No se pudo conectar con el servidor" });
    } finally {
      setEnviando(false);
    }
  }

  const intentosRestantes =
    error?.intentos !== undefined && error?.maxIntentos !== undefined
      ? error.maxIntentos - error.intentos
      : null;

  return (
    <Card>
      <CardHeader
        title="Tus datos fiscales"
        description="Tal como aparecen en tu constancia de situación fiscal. El SAT rechaza la factura si el nombre, el régimen o el código postal no coinciden."
      />
      <CardBody>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="RFC">
              <Input
                value={valores.rfc}
                onChange={(e) => cambiar("rfc", e.target.value.toUpperCase())}
                maxLength={13}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="XAXX010101000"
                aria-invalid={Boolean(campos.rfc)}
                required
              />
              <FieldError mensaje={campos.rfc} />
            </Field>
            <Field label="Código postal" hint="El de tu domicilio fiscal, 5 dígitos.">
              <Input
                value={valores.domicilioFiscal}
                onChange={(e) => cambiar("domicilioFiscal", e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                maxLength={5}
                placeholder="00000"
                aria-invalid={Boolean(campos.domicilioFiscal)}
                required
              />
              <FieldError mensaje={campos.domicilioFiscal} />
            </Field>
          </div>

          <Field label="Nombre o razón social" hint="En mayúsculas y sin el régimen de sociedad (S.A. de C.V., etc.).">
            <Input
              value={valores.nombre}
              onChange={(e) => cambiar("nombre", e.target.value.toUpperCase())}
              autoCapitalize="characters"
              maxLength={300}
              aria-invalid={Boolean(campos.nombre)}
              required
            />
            <FieldError mensaje={campos.nombre} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Régimen fiscal">
              <Select
                value={valores.regimenFiscal}
                onChange={(e) => cambiar("regimenFiscal", e.target.value)}
                aria-invalid={Boolean(campos.regimenFiscal)}
                required
              >
                <option value="">Elige tu régimen</option>
                {regimenesParaRfc.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} - {r.texto}
                  </option>
                ))}
              </Select>
              <FieldError mensaje={campos.regimenFiscal} />
            </Field>
            <Field label="Uso del CFDI">
              <Select
                value={valores.usoCfdi}
                onChange={(e) => cambiar("usoCfdi", e.target.value)}
                aria-invalid={Boolean(campos.usoCfdi)}
                disabled={!valores.regimenFiscal}
                required
              >
                <option value="">{valores.regimenFiscal ? "Elige el uso" : "Primero elige el régimen"}</option>
                {usosParaRegimen.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id} - {u.texto}
                  </option>
                ))}
              </Select>
              <FieldError mensaje={campos.usoCfdi} />
            </Field>
          </div>

          <Field
            label="Correo electrónico"
            hint={
              auto.EmailSugerido
                ? `Te mandamos el enlace a ${auto.EmailSugerido}; si quieres recibir la factura en otro correo, escríbelo aquí.`
                : "Opcional. Ahí te llegan el PDF y el XML."
            }
          >
            <Input
              type="email"
              value={valores.email}
              onChange={(e) => cambiar("email", e.target.value)}
              autoComplete="email"
              placeholder={auto.EmailSugerido || "tu@correo.com"}
              aria-invalid={Boolean(campos.email)}
            />
            <FieldError mensaje={campos.email} />
          </Field>

          {error && !error.campos && (
            <Note tone="danger" title="No se pudo generar la factura">
              {error.error}
              {error.validacion && error.validacion.Errores.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {error.validacion.Errores.map((h, i) => (
                    <li key={i}>
                      <span className="font-mono text-[11.5px]">{h.campo}</span>: {h.mensaje}
                    </li>
                  ))}
                </ul>
              )}
              {intentosRestantes !== null && intentosRestantes <= 3 && (
                <p className="mt-1 font-medium">
                  {intentosRestantes > 0
                    ? `Te quedan ${intentosRestantes} intento${intentosRestantes === 1 ? "" : "s"}.`
                    : "Se agotaron los intentos; contacta al comercio."}
                </p>
              )}
            </Note>
          )}
          {error && error.campos && (
            <Note tone="warn">{error.error}</Note>
          )}

          <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11.5px] text-ink-4">
              Al continuar se genera un CFDI a tu nombre. Los datos de la compra no se pueden cambiar.
            </p>
            <Button type="submit" variant="primary" disabled={enviando}>
              {enviando ? "Generando factura..." : "Generar factura"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function Timbrada({ auto, resultado }: { auto: Autofactura; resultado: ResultadoTimbradoAutofactura | null }) {
  const base = `/api/publico/autofactura/${auto.Codigo}`;
  const uuid = resultado?.UUID ?? auto.UUID ?? "";
  return (
    <Card>
      <CardBody className="space-y-4 py-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok-bg text-xl text-ok">✓</div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-ink">
            {resultado ? "Tu factura está lista" : "Esta compra ya fue facturada"}
          </p>
          <p className="text-sm text-ink-3">
            Emitida por {auto.Emisor.Nombre} ({auto.Emisor.Rfc})
            {(resultado?.FechaTimbrado ?? auto.FechaTimbrado) && (
              <> el {formatoFechaLarga(resultado?.FechaTimbrado ?? auto.FechaTimbrado ?? "")}</>
            )}
            .
          </p>
        </div>
        {uuid && (
          <div className="mx-auto max-w-md rounded-lg bg-surface-2 px-4 py-2">
            <p className="text-[11px] uppercase tracking-wide text-ink-4">Folio fiscal (UUID)</p>
            <p className="break-all font-mono text-[13px] text-ink">{uuid}</p>
          </div>
        )}
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <a href={`${base}/pdf`} className={buttonClass("primary")}>
            Descargar PDF
          </a>
          <a href={`${base}/xml`} className={buttonClass("secondary")}>
            Descargar XML
          </a>
        </div>
        {resultado && (
          <p className="text-[12px] text-ink-4">
            {resultado.CorreoEnviado === "SI" && resultado.Email
              ? `También te la enviamos a ${resultado.Email}.`
              : "Guarda estos archivos: son tu comprobante fiscal."}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
