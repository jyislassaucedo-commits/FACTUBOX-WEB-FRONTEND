import type { ConfigPdfForm } from "@/lib/configPdfShared";

/** Blanco o casi-negro, el que dé más contraste sobre `hex` (fórmula de luminancia relativa). */
function textoSobre(hex: string): string {
  const limpio = hex.replace("#", "");
  if (limpio.length !== 6) return "#111111";
  const r = parseInt(limpio.slice(0, 2), 16) / 255;
  const g = parseInt(limpio.slice(2, 4), 16) / 255;
  const b = parseInt(limpio.slice(4, 6), 16) / 255;
  const luminancia = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminancia > 0.6 ? "#111111" : "#ffffff";
}

const CONCEPTOS_EJEMPLO = [
  {
    clave: "81112101",
    descripcionSat: "Servicios de desarrollo de software a la medida",
    descripcion: "Desarrollo de módulo de facturación",
    cantidad: "1",
    unitario: "1,500.00",
    importe: "1,500.00",
    ivaImporte: "240.00",
  },
  {
    clave: "81112501",
    descripcionSat: "Servicios de hospedaje de aplicaciones",
    descripcion: "Hosting mensual",
    cantidad: "1",
    unitario: "500.00",
    importe: "500.00",
    ivaImporte: "80.00",
  },
];

// Vista previa aproximada, no es el PDF real (eso lo genera el backend) -
// solo ayuda a visualizar el efecto de los colores/opciones antes de
// guardar. Reproduce la forma general del comprobante impreso (encabezado,
// tabla de conceptos, impuestos, totales) sin pretender ser pixel-perfect.
export function PdfPreview({
  form,
  emisorNombre,
  logoBase64,
}: {
  form: ConfigPdfForm;
  emisorNombre: string;
  logoBase64?: string;
}) {
  const fontSize = Math.max(form.tamanoFuente, 6) + 2.5;
  const separadorAlto = Math.max(form.grosorSeparador * 3, 1);
  const textoSobreSeparador = textoSobre(form.colorSeparador);
  const textoSobreFondo = textoSobre(form.colorFondo);

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="mb-3 text-xs font-medium text-ink-3">
        Vista previa aproximada — así se sentirá el PDF, no es el resultado exacto.
      </p>

      {/* El "papel" de aquí para adentro se queda blanco a propósito en
          cualquier tema: representa el PDF real, que siempre se imprime
          sobre fondo blanco. */}
      <div
        className="relative mx-auto max-w-md overflow-hidden rounded-md bg-white shadow-sm"
        style={{
          border: `1px solid ${form.colorContorno}`,
          fontSize: `${fontSize}px`,
          fontFamily: "Arial, Helvetica, sans-serif",
          color: form.colorFuente,
        }}
      >
        {form.mostrarMarcaAgua && (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
            style={{
              transform: "rotate(-30deg)",
              color: form.colorFuente,
              opacity: 0.12,
              fontSize: "1.7rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {form.textoMarcaAgua.trim() || "MUESTRA"}
          </div>
        )}

        {/* Encabezado: logo + emisor, sin teñir - así se ve en el PDF real. */}
        <div className="flex items-start justify-between gap-3 px-3.5 pt-3.5 pb-2.5">
          <div className="flex items-center gap-2.5">
            {logoBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${logoBase64}`}
                alt="Logo"
                className="h-9 w-9 rounded object-contain"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-neutral-300 text-[0.6em] text-neutral-400">
                Logo
              </div>
            )}
            <div>
              <p className="font-semibold leading-tight" style={{ color: form.colorFuente }}>
                {emisorNombre || "Nombre del emisor"}
              </p>
              <p className="text-[0.75em] leading-tight text-neutral-500">
                Régimen fiscal · Lugar de expedición
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold leading-tight" style={{ color: form.colorTitulos }}>
              FACTURA
            </p>
            <p className="text-[0.75em] leading-tight text-neutral-500">CFDI 4.0</p>
          </div>
        </div>

        <div
          style={{ background: form.colorSeparador, height: `${separadorAlto}px` }}
        />

        {/* Tabla de conceptos. */}
        <div className="px-3.5 pt-2.5">
          <table className="w-full border-collapse overflow-hidden rounded-[4px] text-left">
            <thead>
              <tr style={{ background: form.colorSeparador, color: textoSobreSeparador }}>
                <th className="px-1.5 py-1 font-semibold">Clave</th>
                <th className="px-1.5 py-1 font-semibold">Descripción</th>
                <th className="px-1.5 py-1 text-right font-semibold">Cant.</th>
                <th className="px-1.5 py-1 text-right font-semibold">Importe</th>
              </tr>
            </thead>
            <tbody>
              {CONCEPTOS_EJEMPLO.map((c, i) => (
                <tr
                  key={c.clave}
                  style={{
                    background: i % 2 === 1 ? form.colorFondo : "transparent",
                    color: i % 2 === 1 ? textoSobreFondo : form.colorFuente,
                    borderBottom: `1px solid ${form.colorContorno}`,
                  }}
                >
                  <td className="px-1.5 py-1 align-top font-mono text-[0.85em]">{c.clave}</td>
                  <td className="px-1.5 py-1 align-top">
                    <p>{c.descripcion}</p>
                    {form.mostrarDescripSat && (
                      <p className="text-[0.8em] italic opacity-70">{c.descripcionSat}</p>
                    )}
                    {form.mostrarImpuestos && (
                      <p className="mt-0.5 text-[0.78em] opacity-70">
                        Traslado IVA 16% · ${c.ivaImporte}
                      </p>
                    )}
                  </td>
                  <td className="px-1.5 py-1 text-right align-top">{c.cantidad}</td>
                  <td className="px-1.5 py-1 text-right align-top">
                    ${form.mostrarDecimales ? c.importe : c.importe.split(".")[0]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales. */}
        <div className="flex justify-end px-3.5 pb-1 pt-2.5">
          <div className="w-40 space-y-0.5">
            <div className="flex justify-between" style={{ color: form.colorFuente }}>
              <span>Subtotal</span>
              <span>{form.mostrarDecimales ? "2,000.00" : "2,000"}</span>
            </div>
            {form.mostrarDescuentos && (
              <div className="flex justify-between" style={{ color: form.colorFuente }}>
                <span>Descuento</span>
                <span>{form.mostrarDecimales ? "-100.00" : "-100"}</span>
              </div>
            )}
            {form.mostrarImpuestos && (
              <div className="flex justify-between" style={{ color: form.colorFuente }}>
                <span>IVA 16%</span>
                <span>{form.mostrarDecimales ? "304.00" : "304"}</span>
              </div>
            )}
            <div
              className="flex justify-between border-t pt-0.5 font-bold"
              style={{ color: form.colorTitulos, borderColor: form.colorContorno }}
            >
              <span>Total</span>
              <span>{form.mostrarDecimales ? "2,204.00" : "2,204"}</span>
            </div>
          </div>
        </div>

        {form.mostrarImportesCp && (
          <p
            className="px-3.5 pb-3 text-[0.85em] italic"
            style={{ color: form.colorFuente }}
          >
            Son: dos mil doscientos cuatro pesos 00/100 M.N.
          </p>
        )}

        {/* Pie: sello/QR, solo para transmitir que ahí va ese bloque. */}
        <div
          className="flex items-center gap-2.5 border-t px-3.5 py-2.5"
          style={{ borderColor: form.colorContorno }}
        >
          <div className="grid h-9 w-9 shrink-0 grid-cols-3 gap-px rounded-sm border border-neutral-300 p-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className="rounded-[1px]"
                style={{ background: i % 2 === 0 ? "#9ca3af" : "transparent" }}
              />
            ))}
          </div>
          <p className="text-[0.72em] leading-snug text-neutral-400">
            Aquí van el código QR y los sellos digitales del CFDI y del SAT.
          </p>
        </div>
      </div>
    </div>
  );
}
