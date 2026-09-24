/**
 * Facturas: todo lo que se emite. Las secciones y lo que se puede emitir
 * están en el menú "Facturas" de la barra superior (AppShell), no en un
 * lateral: así cada pantalla usa todo el ancho, que el asistente de nueva
 * factura necesita para su riel, el paso y el comprobante.
 */
export default function FacturasLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
