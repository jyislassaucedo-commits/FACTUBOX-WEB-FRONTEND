import { Card, CardBody } from "@/components/ui";

/** Código que no existe (o mal formado): lo lanza page.tsx con notFound(). */
export default function AutofacturaNoEncontrada() {
  return (
    <Card className="mt-10">
      <CardBody className="space-y-2 py-10 text-center">
        <p className="text-lg font-semibold text-ink">Este enlace no corresponde a ninguna venta</p>
        <p className="text-sm text-ink-3">
          Revisa que hayas escaneado el código completo o abre el enlace desde el correo que
          recibiste.
        </p>
      </CardBody>
    </Card>
  );
}
