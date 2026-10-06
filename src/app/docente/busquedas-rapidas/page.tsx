import type { Metadata } from "next";
import { BuscadorOportunidades } from "@/components/docente/buscador-oportunidades";

export const metadata: Metadata = { title: "Búsquedas rápidas" };

export default async function BusquedasRapidasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BuscadorOportunidades modo="rapidas" params={await searchParams} />;
}
