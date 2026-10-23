import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { CursoDescargarLista, type FilaInscripto } from "@/components/institucion/curso-descargar-lista";
import { CursoInscripto } from "@/components/institucion/curso-inscripto";
import { CursoMigas } from "@/components/institucion/curso-migas";
import { BotonLink } from "@/components/ui/button";
import { requerirInstitucion } from "@/lib/auth";
import { exigirBeneficio } from "@/lib/queries/puntuales";
import { esUuid } from "@/lib/busquedas";
import { etiquetaInscriptos, PUNTAJE_POR_DEFECTO } from "@/lib/cursos";
import { fechaDeInput } from "@/lib/fechas";
import { hoyArgentina } from "@/lib/fechas-curso";
import { cursoConInscriptos } from "@/lib/queries/cursos-institucion";

export const metadata: Metadata = { title: "Inscriptos" };

export default async function InscriptosDelCurso({ params }: { params: Promise<{ id: string }> }) {
  const { institucion } = await requerirInstitucion();
  await exigirBeneficio(institucion.plan, "cursos");
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const datos = await cursoConInscriptos(institucion.id, id);
  if (!datos) notFound();
  const { curso: c, inscriptos } = datos;

  const terminaron = inscriptos.filter((i) => i.terminoEn).length;
  const resumen = [
    etiquetaInscriptos(inscriptos.length).toLowerCase(),
    terminaron > 0 && (terminaron === 1 ? "1 ya lo terminó" : `${terminaron} ya lo terminaron`),
  ]
    .filter(Boolean)
    .join(" · ");
  const empezo = !c.fechaInicio || c.fechaInicio <= hoyArgentina();

  const filas: FilaInscripto[] = inscriptos.map((i) => ({
    nombre: i.nombre,
    categoria: i.categoria,
    inscriptoEl: i.inscriptoEl,
    estado: i.terminoEn ? `Terminó el ${fechaDeInput(i.terminoEn)}` : "Cursando",
    certificado: !c.certifica ? "Sin certificado" : i.certificadoEnviado ? "Enviado" : "Sin enviar",
  }));

  return (
    <>
      <CursoMigas actual="Inscriptos" />
      <div className="max-w-[900px]">
        <EncabezadoPagina
          titulo="Inscriptos"
          bajada={`${c.titulo} · ${resumen}`}
          acciones={<CursoDescargarLista titulo={c.titulo} filas={filas} />}
        />
        {inscriptos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no se anotó nadie en este curso"
            texto="Cuando un profesional se inscriba, aparece acá y te llega un aviso."
            accion={
              <BotonLink href={`/institucion/cursos/${c.id}`} variante="secundario">
                Volver al curso
              </BotonLink>
            }
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {inscriptos.map((i) => (
              <CursoInscripto
                key={i.docenteId}
                cursoId={c.id}
                i={i}
                certifica={c.certifica}
                puntos={c.puntaje ?? PUNTAJE_POR_DEFECTO}
                empezo={empezo}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
