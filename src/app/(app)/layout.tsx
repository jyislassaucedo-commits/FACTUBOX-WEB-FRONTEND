import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { getTimbres } from "@/lib/timbres";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo } from "@/lib/emisorActivo";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // El saldo de timbres es de la cuenta, no del emisor: se carga aquí para que
  // esté visible en todas las pantallas.
  //
  // La lista de emisores se carga aquí por lo mismo: desde que el emisor activo
  // vive en la barra, hace falta en todas. getEmisores va envuelto en cache()
  // de React, así que las pantallas que ya la pedían no hacen una segunda
  // llamada.
  const [timbres, emisores] = await Promise.all([getTimbres(), getEmisores()]);
  const rfcActivo = await resolverRfcActivo(emisores);

  return (
    <AppShell user={user} timbres={timbres} emisores={emisores} rfcActivo={rfcActivo}>
      {children}
    </AppShell>
  );
}
