import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", weight: ["600", "700"] });

const DESCRIPCION =
  "Colegios, clubes y natatorios encuentran docentes, entrenadores y guardavidas verificados. Publicá una búsqueda y cubrí cargos y suplencias en días.";

export const metadata: Metadata = {
  // Base de las URLs absolutas de la vista previa al compartir (la imagen sale de app/opengraph-image.tsx).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.unidoar.com.ar"),
  title: { default: "UNIDOAR — Educadores, entrenadores y guardavidas verificados", template: "%s · UNIDOAR" },
  description: DESCRIPCION,
  applicationName: "UNIDOAR",
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "UNIDOAR",
    title: "UNIDOAR — Educadores, entrenadores y guardavidas verificados",
    description: DESCRIPCION,
  },
  twitter: {
    card: "summary_large_image",
    title: "UNIDOAR — Educadores, entrenadores y guardavidas verificados",
    description: DESCRIPCION,
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
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
