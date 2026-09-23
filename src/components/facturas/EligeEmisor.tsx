import { Card, EmptyState } from "@/components/ui";

/**
 * Lo que se ve en una sección que emite cuando el emisor activo es "todos".
 *
 * No es un error: ver el total de varios emisores a la vez es útil y por eso
 * Inicio y la lista de facturas lo permiten. Lo que no se puede es emitir, y
 * decirlo aquí es mejor que esconder la sección — esconderla haría pensar que
 * la función no existe.
 */
export function EligeEmisor({ que }: { que: string }) {
  return (
    <Card>
      <EmptyState
        title="Elige un emisor"
        description={`${que} sale de un emisor concreto. Cámbialo en la barra de arriba y vuelve.`}
      />
    </Card>
  );
}
