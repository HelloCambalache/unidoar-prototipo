import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VistaDeArticulo } from "@/components/ayuda/vista-de-articulo";
import { requerirUsuario } from "@/lib/auth";
import { articuloPorSlug, MANUALES } from "@/lib/ayuda";

type Params = Promise<{ articulo: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { articulo } = await params;
  const encontrado = articuloPorSlug(MANUALES.equipo, articulo);
  return { title: encontrado ? `${encontrado.articulo.titulo} · Ayuda · Backoffice` : "Ayuda · Backoffice" };
}

/** Una guía del manual del equipo. */
export default async function GuiaDelEquipo({ params }: { params: Params }) {
  await requerirUsuario("admin");
  const { articulo } = await params;
  const manual = MANUALES.equipo;
  const encontrado = articuloPorSlug(manual, articulo);
  if (!encontrado) notFound();

  return (
    <>
      <nav aria-label="Dónde estás" className="mb-4 flex flex-wrap items-center gap-x-2 text-[13px] leading-none text-apagado">
        <Link href="/backoffice/ayuda" className="hover:text-navy-700 hover:underline">
          Ayuda
        </Link>
        <span aria-hidden>›</span>
        <span>{manual.titulo}</span>
      </nav>
      <VistaDeArticulo manual={manual} capitulo={encontrado.capitulo} articulo={encontrado.articulo} />
    </>
  );
}
