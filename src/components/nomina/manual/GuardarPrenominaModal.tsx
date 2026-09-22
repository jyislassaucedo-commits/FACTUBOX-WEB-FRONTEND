"use client";

import { useState } from "react";
import { Button, Field, Input, Modal } from "@/components/ui";

/** Pide el nombre con el que se va a guardar la plantilla. */
export function GuardarPrenominaModal({
  inicial,
  sugerido,
  pendiente,
  onClose,
  onGuardar,
}: {
  inicial: string;
  /** Un nombre propuesto a partir del empleado y el periodo. */
  sugerido: string;
  pendiente: boolean;
  onClose: () => void;
  onGuardar: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState(inicial || sugerido);

  return (
    <Modal
      title="Guardar como prenómina"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pendiente}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => onGuardar(nombre.trim())} disabled={pendiente || !nombre.trim()}>
            {pendiente ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre.trim() && !pendiente) onGuardar(nombre.trim());
        }}
        className="space-y-3"
      >
        <Field label="Nombre de la plantilla" hint="Cómo la vas a reconocer en la lista: “Finiquito Félix”, “Quincena base María”.">
          <Input value={nombre} maxLength={120} autoFocus onChange={(e) => setNombre(e.target.value)} />
        </Field>
        <p className="text-[12.5px] text-ink-3">
          Se guarda tal como está, aunque falte algo. La puedes abrir, ajustar las fechas y timbrarla cuantas veces
          haga falta.
        </p>
      </form>
    </Modal>
  );
}
