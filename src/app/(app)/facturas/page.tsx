import Link from "next/link";

export default function FacturasPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Facturas</h1>
        <Link
          href="/facturas/nueva"
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:opacity-90"
        >
          Nueva factura
        </Link>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        El listado de facturas emitidas llega en una próxima fase.
      </p>
    </div>
  );
}
