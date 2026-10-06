import type { Metadata } from "next";
import { BuscadorOportunidades } from "@/components/docente/buscador-oportunidades";

export const metadata: Metadata = { title: "Buscar trabajo" };

export default async function OportunidadesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BuscadorOportunidades modo="todas" params={await searchParams} />;
}
