import type { Metadata } from "next";
import { DocFiltros } from "@/components/backoffice/doc-filtros";
import { DocTabla } from "@/components/backoffice/doc-tabla";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { PaginacionLista } from "@/components/institucion/paginacion-lista";
import { BotonLink } from "@/components/ui/button";
import { requerirUsuario } from "@/lib/auth";
import { hayFiltrosBoDocentes, hrefBoDocentes, leerFiltrosBoDocentes } from "@/lib/backoffice-docentes";
import { listarDocentesBo, opcionesFiltrosBo } from "@/lib/queries/backoffice-docentes";
import { plural } from "@/lib/busquedas";

export const metadata: Metadata = { title: "Profesionales" };

export default async function DocentesBackofficePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // El layout ya exige rol admin, pero Next puede renderizar una página sin volver a renderizar su layout (navegación parcial): se repite acá.
  await requerirUsuario("admin");
  const filtros = leerFiltrosBoDocentes(await searchParams);
  const [lista, opciones] = await Promise.all([listarDocentesBo(filtros), opcionesFiltrosBo()]);
  const filtrado = hayFiltrosBoDocentes(filtros);

  return (
    <>
      <EncabezadoPagina
        titulo="Profesionales"
        bajada={
          filtrado
            ? `${plural(lista.total, "profesional coincide", "profesionales coinciden")} con los filtros.`
            : `${plural(lista.total, "profesional con el alta completa", "profesionales con el alta completa")}.`
        }
      />

      <DocFiltros filtros={filtros} disciplinas={opciones.disciplinas} zonas={opciones.zonas} />

      {lista.total === 0 ? (
        <EstadoVacio
          titulo={filtrado ? "No hay profesionales que coincidan" : "Todavía no hay profesionales con el alta completa"}
          texto={
            filtrado
              ? "Probá con otra búsqueda o sacá algún filtro."
              : "Los perfiles aparecen acá cuando terminan el último paso del alta."
          }
          accion={
            filtrado ? (
              <BotonLink href="/backoffice/docentes" variante="secundario">
                Limpiar filtros
              </BotonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <DocTabla filas={lista.filas} />
          <p className="mt-3 mb-0 text-xs leading-normal text-sutil">
            El scoring es interno (perfil, verificación, actividad y contrataciones): nunca lo ven profesionales ni instituciones.
          </p>
        </>
      )}

      <PaginacionLista pagina={lista.pagina} paginas={lista.paginas} hrefDe={(n) => hrefBoDocentes(filtros, { pagina: n })} />
    </>
  );
}
