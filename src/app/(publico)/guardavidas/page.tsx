import type { Metadata } from "next";
import { LandingCategoria } from "@/components/publico/landing-categoria";

export const metadata: Metadata = {
  title: "Guardavidas habilitados",
  description:
    "Guardavidas y profesores de natación de tu zona, con habilitación e identidad verificadas antes de que los veas.",
};

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

export default function PaginaGuardavidas() {
  return <LandingCategoria categoria="guardavidas" />;
}
