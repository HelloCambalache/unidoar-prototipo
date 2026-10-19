import type { Metadata } from "next";
import { LandingCategoria } from "@/components/publico/landing-categoria";
import { metadatosDeCategoria } from "@/components/publico/metadatos-categoria";

export const metadata: Metadata = metadatosDeCategoria(
  "entrenador",
  "Entrenadores e instructores verificados",
  "Entrenadores y profes de gimnasio y de club de tu zona, con identidad y título verificados, por turno o por temporada.",
);

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

export default function PaginaEntrenadores() {
  return <LandingCategoria categoria="entrenador" />;
}
