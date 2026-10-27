import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BandaDeContacto, BannerDeAyuda } from "@/components/ayuda/banner-de-ayuda";
import { BuscadorDeAyuda } from "@/components/ayuda/buscador-de-ayuda";
import { IndiceDelManual } from "@/components/ayuda/indice-del-manual";
import { PreguntasFrecuentes } from "@/components/ayuda/preguntas-frecuentes";
import { esPerfilPublico, MANUALES } from "@/lib/ayuda";

type Params = Promise<{ perfil: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { perfil } = await params;
  if (!esPerfilPublico(perfil)) return {};
  const manual = MANUALES[perfil];
  return { title: manual.titulo, description: manual.bajada };
}

/** El manual de un perfil (profesionales o instituciones): índice de guías y preguntas frecuentes. El del equipo vive dentro del backoffice. */
export default async function ManualDeAyudaPagina({ params }: { params: Params }) {
  const { perfil } = await params;
  if (!esPerfilPublico(perfil)) notFound();
  const manual = MANUALES[perfil];

  return (
    <div className="mx-auto w-full max-w-[1100px] flex-1 px-12 pt-10 pb-14 max-[900px]:px-6 max-[560px]:pt-6 max-[560px]:pb-10">
      <BannerDeAyuda titulo={manual.titulo} bajada={manual.bajada} migas={[{ texto: "Centro de ayuda", href: "/ayuda" }]}>
        <BuscadorDeAyuda accion="/ayuda" consulta="" />
      </BannerDeAyuda>

      <IndiceDelManual manual={manual} />
      <div className="mt-12">
        <PreguntasFrecuentes preguntas={manual.preguntas} />
      </div>
      <BandaDeContacto />
    </div>
  );
}
