import { LandingCategoria } from "@/components/publico/landing-categoria";
import { metadatosDePagina, PAGINAS } from "@/lib/seo";

export const metadata = metadatosDePagina(PAGINAS.entrenadores);

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

export default function PaginaEntrenadores() {
  return <LandingCategoria categoria="entrenador" />;
}
