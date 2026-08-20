"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Emisor } from "@/lib/emisores";

export default function EmisoresPage() {
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/emisores")
      .then((res) => res.json())
      .then((body) => setEmisores(body.emisores ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Emisores</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Empresas con las que puedes facturar.
          </p>
        </div>
        <Link
          href="/emisores/nuevo"
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:opacity-90"
        >
          Nuevo emisor
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Cargando...</p>
      ) : emisores.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-600">
            Todavía no tienes emisores registrados.
          </p>
          <Link
            href="/emisores/nuevo"
            className="mt-3 inline-block text-sm font-medium text-[var(--brand)] hover:underline"
          >
            Registra tu primer emisor
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs font-medium uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">RFC</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Estatus</th>
                <th className="px-4 py-3">CSD vigente hasta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {emisores.map((emisor) => (
                <tr key={emisor.Rfc} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/emisores/${encodeURIComponent(emisor.Rfc)}`}
                      className="font-medium text-neutral-900 hover:underline"
                    >
                      {emisor.Rfc}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{emisor.Nombre}</td>
                  <td className="px-4 py-3">
                    <EstatusBadge estatus={emisor.Estatus} />
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {emisor.Cert ? emisor.VigenciaCert : "Sin certificado"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EstatusBadge({ estatus }: { estatus: string }) {
  const activo = estatus === "ACTIVADO";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        activo ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {activo ? "Activo" : estatus}
    </span>
  );
}
