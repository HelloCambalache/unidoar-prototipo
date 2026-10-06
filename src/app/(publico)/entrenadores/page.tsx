import type { Metadata } from "next";
import { LandingCategoria } from "@/components/publico/landing-categoria";

export const metadata: Metadata = {
  title: "Entrenadores e instructores verificados",
  description:
    "Entrenadores y profes de gimnasio y de club de tu zona, con identidad y título verificados, por turno o por temporada.",
};

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

export default function PaginaEntrenadores() {
  return <LandingCategoria categoria="entrenador" />;
}
