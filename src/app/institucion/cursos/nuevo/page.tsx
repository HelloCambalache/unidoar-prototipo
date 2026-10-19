import type { Metadata } from "next";
import { CursoFormulario } from "@/components/institucion/curso-formulario";
import { CursoMigas } from "@/components/institucion/curso-migas";
import { requerirInstitucion } from "@/lib/auth";
import { PUNTAJE_POR_DEFECTO, type ValoresCurso } from "@/lib/cursos";

export const metadata: Metadata = { title: "Crear curso" };

const VACIO: ValoresCurso = {
  titulo: "",
  subtitulo: "",
  descripcion: "",
  modalidad: "Presencial",
  profesor: "",
  certifica: true,
  puntaje: String(PUNTAJE_POR_DEFECTO),
  fechaInicio: "",
  fechaFinal: "",
  horario: "",
  direccion: "",
  link: "",
  linkClave: "",
  fotoUrl: "",
};

export default async function CrearCurso() {
  await requerirInstitucion();
  return (
    <>
      <CursoMigas actual="Crear curso" />
      <h1 className="m-0 mb-5 text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] max-[860px]:text-[22px]">Crear curso</h1>
      <CursoFormulario modo="crear" inicial={VACIO} />
    </>
  );
}
