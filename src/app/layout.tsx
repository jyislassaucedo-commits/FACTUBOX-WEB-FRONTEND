import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Factubox Web",
  description: "Facturación electrónica",
};

/**
 * Corre antes de que React hidrate: lee la preferencia guardada (o el
 * prefers-color-scheme del sistema si nunca se eligió una) y pone
 * `data-theme="dark"` en <html> antes del primer paint. Sin esto, la página
 * arrancaría siempre en claro y "saltaría" a oscuro un instante después.
 */
const ANTI_PARPADEO = `
try {
  var t = localStorage.getItem('factubox-theme');
  if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (t === 'dark') document.documentElement.dataset.theme = 'dark';
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANTI_PARPADEO }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
