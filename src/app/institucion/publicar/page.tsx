import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { AvisoDeMora } from "@/components/institucion/aviso-de-mora";
import { FormularioBusqueda, type ValoresFormulario } from "@/components/institucion/formulario-busqueda";
import { BotonLink } from "@/components/ui/button";
import { Tarjeta } from "@/components/ui/tarjeta";
import { getDb } from "@/db";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid, tipoDeFormulario } from "@/lib/busquedas";
import { TIPOS_BUSQUEDA, TURNOS } from "@/lib/catalogo";
import { plazoLegible } from "@/lib/fechas";
import { permisoParaPublicarPuntual } from "@/lib/puntual";
import { asignaturasPorCategoria, busquedaPropia } from "@/lib/queries/busquedas";
import { moraDeInstitucion } from "@/lib/queries/mora";
import { planes } from "@/lib/queries/planes";
import { saldoDeBusquedas } from "@/lib/queries/puntuales";
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

  const [catalogo, existente, sedesGuardadas, P, mora] = await Promise.all([
    asignaturasPorCategoria(),
    editarId ? (esUuid(editarId) ? busquedaPropia(institucion.id, editarId) : null) : null,
    sedesDeInstitucion(institucion.id),
    planes(),
    moraDeInstitucion(institucion),
  ]);
  // ?editar= con un id que no existe o que es de otra institución.
  if (editarId && !existente) notFound();

  // Búsqueda puntual (el plan sin abono): para publicar una nueva hace falta una búsqueda pagada. Editar una ya publicada no pide nada.
  const puntual = P.esPuntual(institucion.plan);
  const permiso =
    puntual && !existente
      ? permisoParaPublicarPuntual({
          ...(await saldoDeBusquedas(getDb(), institucion.id)),
          maxAbiertas: P.condiciones.puntual.busquedasAbiertas,
          sedes: 1,
          precio: P.precioDePlan(institucion.plan),
        })
      : null;

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
        nivel: existente.nivel ?? "",
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
      {/* Con la cuenta limitada por una factura vencida publicar no se puede (la acción también lo frena): el cartel lo explica antes de llenar el formulario. */}
      <AvisoDeMora mora={mora} />
      {permiso && !permiso.ok ? (
        <Tarjeta className="max-w-[980px] p-[22px]">
          <h2 className="m-0 mb-1.5 text-base leading-tight font-semibold">Todavía no podés publicar una búsqueda nueva</h2>
          <p className="m-0 mb-4 text-sm leading-normal text-tinta-2">{permiso.error}</p>
          <div className="flex flex-wrap gap-3">
            <BotonLink href="/contacto" variante="primario">
              Escribirnos para abonarla
            </BotonLink>
            <BotonLink href="/institucion/plan" variante="secundario">
              Ver mis búsquedas
            </BotonLink>
          </div>
        </Tarjeta>
      ) : (
        <>
          {permiso?.ok && (
            <p className="mt-0 mb-4 max-w-[980px] rounded-caja bg-navy-50 px-3.5 py-2.5 text-[13px] leading-normal text-navy-700">
              Tenés una búsqueda pagada: al publicarla queda abierta {P.condiciones.puntual.vigenciaDias} días y después se cierra sola.
            </p>
          )}
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
      )}
    </>
  );
}
