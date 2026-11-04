import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CursoDetalle } from "@/components/docente/curso-detalle";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { cursoParaInstitucionPorId } from "@/lib/queries/cursos";
import { cursoPropio } from "@/lib/queries/cursos-institucion";
import { exigirBeneficio } from "@/lib/queries/puntuales";

export const metadata: Metadata = { title: "Curso" };

/** Un curso de otra institución, con el botón para anotar a la institución de quien mira. */
export default async function CursoAjeno({ params }: { params: Promise<{ id: string }> }) {
  const { institucion } = await requerirInstitucion();
  await exigirBeneficio(institucion.plan, "cursos");
  const { id } = await params;
  if (!esUuid(id)) notFound();
  // Un curso propio se administra en «Mis cursos», no se explora.
  if (await cursoPropio(institucion.id, id)) redirect(`/institucion/cursos/${id}`);
  const curso = await cursoParaInstitucionPorId(institucion.id, id);
  if (!curso) notFound();
  return <CursoDetalle c={curso} para="institucion" />;
}
