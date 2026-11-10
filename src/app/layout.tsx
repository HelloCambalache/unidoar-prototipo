import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { ConfirmacionProvider } from "@/components/ui/confirmacion";
import { ToastProvider } from "@/components/ui/toast";
import { imagenesParaCompartir, NOMBRE_DEL_SITIO, PAGINAS, tituloParaCompartir } from "@/lib/seo";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", weight: ["600", "700"] });

// Lo que dice el sitio cuando una página no define lo suyo: habla a los dos públicos (ver src/lib/seo.ts). Sin `url`: no es de ninguna página.
const INICIO = PAGINAS.inicio;

export const metadata: Metadata = {
  // Base de las URLs absolutas de la vista previa al compartir (las imágenes salen de /og/<público>.png: ver src/lib/seo.ts).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.unidoar.com.ar"),
  title: { default: INICIO.titulo, template: `%s · ${NOMBRE_DEL_SITIO}` },
  description: INICIO.descripcion,
  applicationName: NOMBRE_DEL_SITIO,
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: NOMBRE_DEL_SITIO,
    title: tituloParaCompartir(INICIO),
    description: INICIO.descripcion,
    images: imagenesParaCompartir("general"),
  },
  twitter: {
    card: "summary_large_image",
    title: tituloParaCompartir(INICIO),
    description: INICIO.descripcion,
    images: imagenesParaCompartir("general"),
  },
  icons: {
    icon: [
      { url: "/assets/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/assets/favicon-180.png",
  },
  // Mientras sea un entorno de prueba, no indexar (igual que el prototipo).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-app font-sans text-tinta antialiased">
        <ToastProvider>
          <ConfirmacionProvider>{children}</ConfirmacionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
