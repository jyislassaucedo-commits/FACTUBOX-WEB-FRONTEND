import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { LogoutButton } from "@/components/LogoutButton";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <span className="text-sm font-semibold text-neutral-900">
          Factubox Web
        </span>
        <LogoutButton />
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Bienvenido, {user.Nombre}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {user.Email} · RFC {user.Rfc} · {user.Tipo}
        </p>
      </main>
    </div>
  );
}
