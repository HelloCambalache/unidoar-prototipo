import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CursoBorrar } from "@/components/institucion/curso-borrar";
import { CursoFormulario } from "@/components/institucion/curso-formulario";
import { CursoMigas } from "@/components/institucion/curso-migas";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { MODALIDADES, PUNTAJE_POR_DEFECTO, type ValoresCurso } from "@/lib/cursos";
import { cursoConInscriptos } from "@/lib/queries/cursos-institucion";

export const metadata: Metadata = { title: "Editar curso" };

export default async function EditarCurso({ params }: { params: Promise<{ id: string }> }) {
  const { institucion } = await requerirInstitucion();
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const datos = await cursoConInscriptos(institucion.id, id);
  if (!datos) notFound();
  const { curso, inscriptos } = datos;

  const inicial: ValoresCurso = {
    titulo: curso.titulo,
    subtitulo: curso.subtitulo ?? "",
    descripcion: curso.descripcion ?? "",
    modalidad: MODALIDADES.find((m) => m === curso.modalidad) ?? "Presencial",
    profesor: curso.profesor ?? "",
    certifica: curso.certifica,
    puntaje: String(curso.puntaje ?? PUNTAJE_POR_DEFECTO),
    fechaInicio: curso.fechaInicio ?? "",
    fechaFinal: curso.fechaFinal ?? "",
    horario: curso.horario ?? "",
    direccion: curso.direccion ?? "",
    link: curso.link ?? "",
    linkClave: curso.linkClave ?? "",
    fotoUrl: curso.fotoUrl ?? "",
  };

  return (
    <>
      <CursoMigas actual="Editar curso" />
      <h1 className="m-0 mb-5 text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] max-[860px]:text-[22px]">Editar curso</h1>
      <CursoFormulario key={curso.id} modo="editar" cursoId={curso.id} inicial={inicial} />
      <CursoBorrar
        cursoId={curso.id}
        titulo={curso.titulo}
        inscriptos={inscriptos.length}
        conTerminados={inscriptos.some((i) => i.terminoEn || i.certificadoEnviado)}
      />
    </>
  );
}
