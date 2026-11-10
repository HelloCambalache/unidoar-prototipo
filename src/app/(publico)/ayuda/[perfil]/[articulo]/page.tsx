import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BandaDeContacto } from "@/components/ayuda/banner-de-ayuda";
import { VistaDeArticulo } from "@/components/ayuda/vista-de-articulo";
import { articuloPorSlug, esPerfilPublico, MANUALES, rutaDeManual } from "@/lib/ayuda";
import { metadatosDeAyuda, tituloDeGuia } from "@/lib/seo";

type Params = Promise<{ perfil: string; articulo: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { perfil, articulo } = await params;
  if (!esPerfilPublico(perfil)) return {};
  const encontrado = articuloPorSlug(MANUALES[perfil], articulo);
  if (!encontrado) return {};
  return metadatosDeAyuda({
    manual: perfil,
    titulo: tituloDeGuia(perfil, encontrado.articulo.titulo),
    descripcion: encontrado.articulo.resumen,
    ruta: `${rutaDeManual(perfil)}/${encontrado.articulo.slug}`,
  });
}

/** Una guía de un manual público. */
export default async function GuiaDeAyuda({ params }: { params: Params }) {
  const { perfil, articulo } = await params;
  if (!esPerfilPublico(perfil)) notFound();
  const manual = MANUALES[perfil];
  const encontrado = articuloPorSlug(manual, articulo);
  if (!encontrado) notFound();

  return (
    <div className="mx-auto w-full max-w-[1100px] flex-1 px-12 pt-8 pb-14 max-[900px]:px-6 max-[560px]:pt-6 max-[560px]:pb-10">
      <nav aria-label="Dónde estás" className="mb-5 flex flex-wrap items-center gap-x-2 text-[13px] leading-none text-apagado">
        <Link href="/ayuda" className="hover:text-navy-700 hover:underline">
          Centro de ayuda
        </Link>
        <span aria-hidden>›</span>
        <Link href={rutaDeManual(perfil)} className="hover:text-navy-700 hover:underline">
          {manual.titulo}
        </Link>
      </nav>
      <VistaDeArticulo manual={manual} capitulo={encontrado.capitulo} articulo={encontrado.articulo} />
      <BandaDeContacto />
    </div>
  );
}
