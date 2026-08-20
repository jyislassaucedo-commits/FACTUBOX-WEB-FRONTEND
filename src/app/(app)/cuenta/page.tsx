import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPerfil } from "@/lib/perfil";
import { Avatar } from "@/components/Avatar";
import { Card, CardBody, CardHeader, Note, Pill } from "@/components/ui";
import { DatosCuentaCard } from "@/components/cuenta/DatosCuentaCard";
import { CorreoCard } from "@/components/cuenta/CorreoCard";
import { PasswordCard } from "@/components/cuenta/PasswordCard";
import { FotoPerfilCard } from "@/components/cuenta/FotoPerfilCard";

export const metadata: Metadata = { title: "Mi cuenta · Factubox" };

/**
 * Mi cuenta.
 *
 * Server Component: los datos se leen aquí una sola vez y las tarjetas mutan
 * vía /api/cuenta/* y llaman router.refresh(). Mismo patrón que las secciones
 * de emisor — sin "Cargando…" por tarjeta y sin una copia del perfil viviendo
 * en useState.
 *
 * Una sola pantalla para USUARIO y SUBUSUARIO: qué se puede editar lo dicta
 * perfil.Editable, que llega del servidor.
 */
export default async function CuentaPage() {
  const perfil = await getPerfil();

  if (!perfil) {
    redirect("/login");
  }

  const esSub = perfil.EsSubusuario === "SI";
  const activa = (perfil.Status ?? "").toUpperCase() === "ACTIVO";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center gap-4">
        <Avatar src={perfil.ImagenUrl} nombre={perfil.Nombre} size="md" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
            {perfil.Nombre}
          </h1>
          <p className="truncate text-[12.5px] text-ink-3">{perfil.Email}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Pill tone={esSub ? "violet" : "brand"}>
            {esSub ? "Subusuario" : "Titular"}
          </Pill>
          <Pill tone={activa ? "ok" : "warn"}>{perfil.Status}</Pill>
        </div>
      </header>

      {esSub && (
        <Note tone="info" title="Cuenta de subusuario">
          Perteneces a la cuenta de <strong>{perfil.NombreTitular}</strong> (
          {perfil.Rfc}). Puedes cambiar tu nombre, tu correo, tu contraseña y tu
          foto; los datos fiscales y tus permisos los administra el titular.
        </Note>
      )}

      <FotoPerfilCard
        nombre={perfil.Nombre}
        imagenUrl={perfil.ImagenUrl}
        editable={perfil.Editable.Imagen}
      />

      <DatosCuentaCard perfil={perfil} />

      <CorreoCard perfil={perfil} />

      <PasswordCard />

      <Card>
        <CardHeader
          title="Información de la cuenta"
          description="Estos datos los administra el sistema."
        />
        <CardBody>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Dato etiqueta="Tipo de cuenta" valor={perfil.Tipo} />
            <Dato etiqueta="Estatus" valor={perfil.Status} />
            <Dato etiqueta="Alta" valor={formatoFecha(perfil.Fechareg)} />
            <Dato etiqueta="Versión" valor={perfil.Version || "—"} />
            {esSub && <Dato etiqueta="RFC de la cuenta" valor={perfil.Rfc} mono />}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  mono,
}: {
  etiqueta: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.07em] text-ink-4">
        {etiqueta}
      </dt>
      <dd className={mono ? "truncate font-mono text-sm text-ink" : "truncate text-sm text-ink"}>
        {valor || "—"}
      </dd>
    </div>
  );
}

/** "2024-03-11 09:42:00" → "11 mar 2024". Devuelve el original si no parsea. */
function formatoFecha(valor: string): string {
  if (!valor) return "—";
  const fecha = new Date(valor.replace(" ", "T"));
  if (Number.isNaN(fecha.getTime())) return valor;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(fecha);
}
