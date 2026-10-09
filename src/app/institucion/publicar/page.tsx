import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { FormularioBusqueda, type ValoresFormulario } from "@/components/institucion/formulario-busqueda";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid, tipoDeFormulario } from "@/lib/busquedas";
import { NIVELES, TIPOS_BUSQUEDA, TURNOS } from "@/lib/catalogo";
import { plazoLegible } from "@/lib/fechas";
import { asignaturasPorCategoria, busquedaPropia } from "@/lib/queries/busquedas";
import { sedesDeInstitucion } from "@/lib/queries/sedes";
import { sedePrincipal } from "@/lib/sedes";

export const metadata: Metadata = { title: "Publicar una búsqueda" };

/** El valor guardado si sigue siendo una opción vigente del vocabulario; si no, "sin especificar". */
function opcion<const T extends readonly string[]>(lista: T, valor: string | null | undefined): T[number] | "" {
  return lista.find((o) => o === valor) ?? "";
}

export default async function PublicarBusqueda({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { institucion } = await requerirInstitucion();
  const { editar, urgente } = await searchParams;
  const editarId = Array.isArray(editar) ? editar[0] : editar;
  // Desde el botón "Búsqueda urgente" de Buscar profesionales: la búsqueda nueva arranca como "Suplencia rápida".
  const esUrgente = (Array.isArray(urgente) ? urgente[0] : urgente) === "1";

  const [catalogo, existente, sedesGuardadas] = await Promise.all([
    asignaturasPorCategoria(),
    editarId ? (esUuid(editarId) ? busquedaPropia(institucion.id, editarId) : null) : null,
    sedesDeInstitucion(institucion.id),
  ]);
  // ?editar= con un id que no existe o que es de otra institución.
  if (editarId && !existente) notFound();

  // La sede de la búsqueda (o, en una nueva o sin sede, la principal): de ahí sale la zona que arranca en el formulario.
  const sedeActual = sedesGuardadas.find((s) => s.id === existente?.sedeId) ?? sedePrincipal(sedesGuardadas);
  const zonaDeLaSede = sedeActual?.zona ?? institucion.zona ?? "";
  const sedeId = sedeActual?.id ?? "";
  const sedes = sedesGuardadas.map((s) => ({ id: s.id, nombre: s.nombre, zona: s.zona ?? "" }));
  const inicial: ValoresFormulario = existente
    ? {
        puesto: existente.puesto,
        categoria: existente.categoria,
        disciplina: existente.disciplina,
        nivel: opcion(NIVELES, existente.nivel),
        tipo: opcion(TIPOS_BUSQUEDA, tipoDeFormulario(existente)) || "Titular",
        cargaHoraria: existente.cargaHoraria ?? "",
        turno: opcion(TURNOS, existente.turno),
        fechaInicio: existente.fechaInicio ?? "",
        sedeId,
        zona: existente.zona ?? zonaDeLaSede,
        descripcion: existente.descripcion ?? "",
        requisitos: existente.requisitos.join("\n"),
        beneficios: existente.beneficios.join("\n"),
      }
    : {
        puesto: "",
        categoria: "educador",
        disciplina: "",
        nivel: "",
        tipo: esUrgente ? "Suplencia rápida" : "Titular",
        cargaHoraria: "",
        turno: "",
        fechaInicio: "",
        sedeId,
        zona: zonaDeLaSede,
        descripcion: "",
        requisitos: "",
        beneficios: "",
      };

  return (
    <>
      <EncabezadoPagina
        titulo={existente ? "Editar búsqueda" : "Publicá una búsqueda"}
        bajada={
          existente
            ? "Actualizá los datos de la búsqueda publicada."
            : "Un solo paso. Los profesionales de tu zona la ven en el momento en que la publicás."
        }
        className="mb-[22px]"
      />
      <FormularioBusqueda
        key={existente?.id ?? "nueva"}
        modo={existente ? "editar" : "crear"}
        busquedaId={existente?.id}
        inicial={inicial}
        catalogo={catalogo}
        sedes={sedes}
        plazoActual={existente?.rapida && existente.venceEn ? plazoLegible(existente.venceEn).texto : null}
      />
    </>
  );
}
