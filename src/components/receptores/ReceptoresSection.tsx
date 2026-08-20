"use client";

import { useEffect, useState } from "react";
import type { Receptor } from "@/lib/receptores";
import { ReceptorFormModal } from "./ReceptorFormModal";

export function ReceptoresSection({ rfc }: { rfc: string }) {
  const [receptores, setReceptores] = useState<Receptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  function cargar() {
    fetch(`/api/empresas/${encodeURIComponent(rfc)}/receptores`)
      .then((res) => res.json())
      .then((body) => setReceptores(body.receptores ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(cargar, [rfc]);

  async function handleEliminar(receptor: Receptor) {
    setError(null);
    const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/receptores`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfcReceptor: receptor.Rfc }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "No se pudo eliminar el receptor");
      return;
    }
    cargar();
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Receptores</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Clientes que puedes seleccionar al hacer una factura.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="whitespace-nowrap text-sm font-medium text-[var(--brand)] hover:underline"
        >
          + Agregar receptor
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-500">Cargando...</p>
      ) : receptores.length > 0 ? (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs font-medium uppercase text-neutral-500">
            <tr>
              <th className="py-1.5 pr-2">RFC</th>
              <th className="py-1.5 pr-2">Nombre</th>
              <th className="py-1.5 pr-2">Uso CFDI</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {receptores.map((r) => (
              <tr key={r.Rfc}>
                <td className="py-1.5 pr-2 font-medium text-neutral-900">{r.Rfc}</td>
                <td className="py-1.5 pr-2 text-neutral-700">{r.Nombre}</td>
                <td className="py-1.5 pr-2 text-neutral-700">{r.UsoCfdi}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleEliminar(r)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">Sin receptores todavía.</p>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {modalAbierto && (
        <ReceptorFormModal
          rfcEmisor={rfc}
          onClose={() => setModalAbierto(false)}
          onSaved={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}
