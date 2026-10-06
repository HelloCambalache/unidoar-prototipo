import type { Metadata } from "next";
import { PantallaBuscadorDocentes, type ParametrosDePagina } from "@/components/institucion/pantalla-buscador-docentes";

export const metadata: Metadata = { title: "Buscar profesionales" };

export default function BuscarDocentesPage({ searchParams }: { searchParams: ParametrosDePagina }) {
  return <PantallaBuscadorDocentes modo="catalogo" searchParams={searchParams} />;
}
