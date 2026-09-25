"use client";

import Link from "next/link";
import { Note, Select } from "@/components/ui";
import { mensajeDe, type NominaManualForm, type ProblemaManual } from "@/lib/nominaManualShared";
import type { Serie } from "@/lib/series";
import { Campo } from "./campos";

/**
 * Primer paso del recibo, igual que en la factura: quién emite y con qué
 * serie. El emisor es el activo (se cambia desde el selector de emisor de
 * arriba); lo que se decide aquí es la serie, y se avisa si a la empresa le
 * falta el registro patronal, que sin él no se arma el recibo.
 */
export function PasoEmisorNomina({
  rfc,
  nombreEmisor,
  registroPatronalEmpresa,
  series,
  form,
  set,
  problemas,
  mostrarErrores,
}: {
  rfc: string;
  nombreEmisor: string;
  registroPatronalEmpresa: string;
  series: Serie[];
  form: NominaManualForm;
  set: (cambio: Partial<NominaManualForm>) => void;
  problemas: ProblemaManual[];
  mostrarErrores: boolean;
}) {
  const err = (campo: string) => (mostrarErrores ? mensajeDe(problemas, campo) : null);
  const rfcUrl = encodeURIComponent(rfc);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
          <p className="text-[12px] font-semibold text-ink-3">Emisor</p>
          <p className="mt-0.5 text-[14px] font-semibold text-ink">{nombreEmisor}</p>
          <p className="font-mono text-[12px] text-ink-3">{rfc}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
          <p className="text-[12px] font-semibold text-ink-3">Registro patronal de la empresa</p>
          {registroPatronalEmpresa ? (
            <p className="mt-0.5 font-mono text-[14px] font-semibold text-ink">{registroPatronalEmpresa}</p>
          ) : (
            <p className="mt-0.5 text-[13px] text-warn">Sin capturar</p>
          )}
          <p className="text-[12px] text-ink-3">Si el empleado tiene uno propio, se usa el suyo.</p>
        </div>
      </div>

      {!registroPatronalEmpresa && (
        <Note tone="warn">
          La empresa no tiene registro patronal. Si el empleado tampoco lo tiene, no se puede armar el recibo.
          Captúralo en{" "}
          <Link href={`/emisores/${rfcUrl}/empleados`} className="font-semibold underline">
            Emisor → Empleados
          </Link>
          .
        </Note>
      )}

      <Campo label="Serie" error={err("serie")} hint="Solo series de tipo Nómina. El folio sigue solo." className="max-w-xs">
        <Select value={form.serie} onChange={(e) => set({ serie: e.target.value })}>
          <option value="">Selecciona…</option>
          {series.map((s) => (
            <option key={s.Nombre} value={s.Nombre}>
              {s.Nombre}
            </option>
          ))}
        </Select>
      </Campo>
      {series.length === 0 && (
        <Note tone="warn">
          No hay series de tipo Nómina. Crea una en{" "}
          <Link href={`/emisores/${rfcUrl}/series`} className="font-semibold underline">
            Series y folios
          </Link>
          .
        </Note>
      )}
    </div>
  );
}
