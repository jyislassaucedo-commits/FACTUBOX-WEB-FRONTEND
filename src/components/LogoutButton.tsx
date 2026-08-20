"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useProgresoManual } from "@/components/carga/useAccionServidor";

/**
 * Cierre de sesion, compartido por el menu de usuario del encabezado y el
 * cajon movil.
 *
 * Vive en un hook y no duplicado en cada componente porque el orden importa:
 * primero se revoca el token en el servidor y solo despues se navega. Al
 * reves, la pantalla de destino alcanzaria a renderizarse con la sesion viva.
 */
export function useLogout() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const progreso = useProgresoManual();

  async function logout() {
    setSaliendo(true);
    const terminarProgreso = progreso("Cerrando tu sesión…");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      terminarProgreso();
      // Aunque la peticion falle hay que mandar al login: la cookie es
      // httpOnly, el cliente no puede saber si quedo viva y el middleware
      // decide desde el servidor. Quedarse en la pantalla actual mostrando
      // datos de una sesion que quiza ya no existe es peor.
      router.push("/login");
      router.refresh();
    }
  }

  return { logout, saliendo };
}

export function LogoutButton() {
  const { logout, saliendo } = useLogout();

  return (
    <Button variant="secondary" size="sm" onClick={logout} disabled={saliendo}>
      {saliendo ? "Saliendo..." : "Cerrar sesión"}
    </Button>
  );
}
