import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Marco de las páginas públicas (hoy, la autofactura por QR). Va aparte de
 * (app) a propósito: aquel layout redirige a /login y monta el AppShell con
 * menú, timbres y usuario, y nada de eso aplica a un comprador que llegó desde
 * un ticket. Solo logo, contenido y el mismo interruptor de tema.
 */
export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Image src="/factubox-logo.png" alt="Factubox" width={4705} height={960} className="h-6 w-auto" priority />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 justify-center px-4 pb-10 sm:px-6">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
      <footer className="px-4 py-4 text-center text-[11.5px] text-ink-4">
        Facturación electrónica con Factubox
      </footer>
    </div>
  );
}
