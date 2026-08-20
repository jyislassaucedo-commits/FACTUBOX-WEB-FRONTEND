import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { getTimbres } from "@/lib/timbres";
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
  const timbres = await getTimbres();

  return (
    <AppShell user={user} timbres={timbres}>
      {children}
    </AppShell>
  );
}
