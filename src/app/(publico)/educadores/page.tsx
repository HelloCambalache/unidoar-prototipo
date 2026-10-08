import type { Metadata } from "next";
import { LandingCategoria } from "@/components/publico/landing-categoria";

export const metadata: Metadata = {
  title: "Profesionales y maestros verificados",
  description:
    "Profesores de Secundario y Terciario, y maestras y maestros de Nivel Inicial y Primario de tu zona, con identidad y título verificados.",
};

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

export default function PaginaEducadores() {
  return <LandingCategoria categoria="educador" />;
}
