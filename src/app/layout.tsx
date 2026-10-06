import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", weight: ["600", "700"] });

export const metadata: Metadata = {
  title: { default: "UNIDOAR — Docentes, entrenadores y guardavidas verificados", template: "%s · UNIDOAR" },
  description:
    "Conectamos instituciones con docentes, profesores, entrenadores y guardavidas verificados. Cubrí cargos y suplencias en días.",
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
