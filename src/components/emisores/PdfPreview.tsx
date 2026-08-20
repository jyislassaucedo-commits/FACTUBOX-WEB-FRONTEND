import type { ConfigPdfForm } from "@/lib/configPdfShared";

// Vista previa aproximada, no es el PDF real (eso lo genera el backend con
// FPDF) - solo ayuda a visualizar el efecto de los colores/opciones antes
// de guardar.
export function PdfPreview({
  form,
  emisorNombre,
  logoBase64,
}: {
  form: ConfigPdfForm;
  emisorNombre: string;
  logoBase64?: string;
}) {
  const fontSize = Math.max(form.tamanoFuente, 6) + 3;
  const separadorAlto = Math.max(form.grosorSeparador * 3, 1);

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="mb-3 text-xs font-medium text-ink-3">
        Vista previa aproximada
      </p>

      {/* El "papel" de aquí para adentro se queda blanco a propósito en
          cualquier tema: representa el PDF real, que siempre se imprime
          sobre fondo blanco. */}
      <div
        className="relative mx-auto max-w-sm overflow-hidden rounded-md shadow-sm"
        style={{
          border: `1px solid ${form.colorContorno}`,
          fontSize: `${fontSize}px`,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {form.mostrarMarcaAgua && (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            style={{
              transform: "rotate(-30deg)",
              color: form.colorFuente,
              opacity: 0.15,
              fontSize: "1.6rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {form.textoMarcaAgua || "MUESTRA"}
          </div>
        )}

        <div
          className="flex items-center justify-between gap-2 px-3 py-2"
          style={{ background: form.colorFondo }}
        >
          <div className="flex items-center gap-2">
            {logoBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${logoBase64}`}
                alt="Logo"
                className="h-8 w-8 rounded bg-white object-contain"
              />
            ) : (
              <div className="h-8 w-8 rounded bg-white/60" />
            )}
            <span className="font-medium" style={{ color: form.colorTitulos }}>
              {emisorNombre || "Nombre del emisor"}
            </span>
          </div>
          <span className="font-semibold" style={{ color: form.colorTitulos }}>
            FACTURA
          </span>
        </div>

        <div
          style={{ background: form.colorSeparador, height: `${separadorAlto}px` }}
        />

        <div className="space-y-1 bg-white px-3 py-2">
          <div
            className="flex justify-between font-medium"
            style={{ color: form.colorTitulos }}
          >
            <span>Descripción</span>
            <span>Importe</span>
          </div>
          {["Producto o servicio de ejemplo", "Otro concepto de ejemplo"].map((linea) => (
            <div
              key={linea}
              className="flex justify-between"
              style={{ color: form.colorFuente }}
            >
              <span>{linea}</span>
              <span>
                {form.mostrarDecimales ? "1,000.00" : "1,000"}
              </span>
            </div>
          ))}

          <div className="mt-2 space-y-0.5 border-t border-neutral-200 pt-1">
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
              className="flex justify-between font-semibold"
              style={{ color: form.colorTitulos }}
            >
              <span>Total</span>
              <span>{form.mostrarDecimales ? "2,204.00" : "2,204"}</span>
            </div>
          </div>

          {form.mostrarImportesCp && (
            <p className="mt-1 text-[0.85em] italic" style={{ color: form.colorFuente }}>
              Son: dos mil doscientos cuatro pesos 00/100 M.N.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
