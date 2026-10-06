import type { Metadata } from "next";
import { PantallaBuscadorDocentes, type ParametrosDePagina } from "@/components/institucion/pantalla-buscador-docentes";

export const metadata: Metadata = { title: "Suplencias rápidas" };

export default function BusquedasRapidasPage({ searchParams }: { searchParams: ParametrosDePagina }) {
  return <PantallaBuscadorDocentes modo="rapidas" searchParams={searchParams} />;
}
