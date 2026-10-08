import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { CajonPostulacion } from "@/components/docente/cajon-postulacion";
import { FilaClicable } from "@/components/docente/fila-clicable";
import { FiltrosPostulacionesBarra } from "@/components/docente/filtros-postulaciones";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Pestanas } from "@/components/ui/pestanas";
import { Tabla } from "@/components/ui/tabla";
import { requerirDocente } from "@/lib/auth";
import { hrefPostulaciones, leerFiltrosPostulaciones } from "@/lib/oportunidades";
import { detallePostulacion, postulacionesDelDocente } from "@/lib/queries/postulaciones";

export const metadata: Metadata = { title: "Mis postulaciones" };

export default async function PostulacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { docente } = await requerirDocente();
  const filtros = leerFiltrosPostulaciones(await searchParams);

  const [listado, detalle] = await Promise.all([
    postulacionesDelDocente(docente.id, filtros),
    // Una postulación que no existe o es de otro docente simplemente no abre el cajón.
    filtros.abrir ? detallePostulacion(filtros.abrir, docente.id) : null,
  ]);
  const hayFiltros = Boolean(filtros.q || filtros.nivel || filtros.zona);

  return (
    <>
      <h1 className="m-0 mb-5 text-2xl leading-[1.25] font-semibold tracking-[-0.018em] max-[860px]:text-[22px]">
        Mis postulaciones
      </h1>

      <FiltrosPostulacionesBarra filtros={filtros} niveles={listado.niveles} zonas={listado.zonas} />

      <Pestanas
        className="mb-4"
        activa={filtros.tab}
        items={[
          {
            clave: "activas",
            etiqueta: "Activas",
            cantidad: listado.conteo.activas,
            href: hrefPostulaciones(filtros, { tab: "activas", abrir: null }),
          },
          {
            clave: "cerradas",
            etiqueta: "Cerradas",
            cantidad: listado.conteo.cerradas,
            href: hrefPostulaciones(filtros, { tab: "cerradas", abrir: null }),
          },
        ]}
      />

      {listado.filas.length === 0 ? (
        listado.total === 0 ? (
          <EstadoVacio
            titulo="Todavía no te postulaste a ninguna búsqueda"
            texto="Cuando te postules (o una institución te invite), vas a seguir cada paso desde acá."
            accion={
              <BotonLink variante="primario" href="/docente/oportunidades">
                Buscar trabajo
              </BotonLink>
            }
          />
        ) : (
          <EstadoVacio
            titulo={
              hayFiltros
                ? "Ninguna postulación coincide con tu búsqueda"
                : filtros.tab === "activas"
                  ? "No tenés postulaciones activas"
                  : "No tenés postulaciones cerradas"
            }
            texto={
              hayFiltros
                ? "Probá con otro texto o sacá algún filtro."
                : filtros.tab === "activas"
                  ? "Las que terminaron (contratación, postulación que no siguió o búsqueda cerrada) están en la pestaña Cerradas."
                  : "Acá aparecen las postulaciones que terminaron."
            }
          />
        )
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Puesto</th>
              <th>Institución</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {listado.filas.map((f) => {
              const href = hrefPostulaciones(filtros, { abrir: f.id });
              return (
                <FilaClicable key={f.id} href={href}>
                  <td className="font-semibold">
                    <Link href={href} scroll={false} className="text-tinta hover:text-tinta">
                      {f.puesto}
                    </Link>
                  </td>
                  <td>{f.institucion}</td>
                  <td>
                    <Insignia tono={f.estado.tono}>{f.estado.texto}</Insignia>
                  </td>
                  <td className="whitespace-nowrap text-apagado">{f.cuando}</td>
                </FilaClicable>
              );
            })}
          </tbody>
        </Tabla>
      )}

      {detalle && (
        <CajonPostulacion key={detalle.id} detalle={detalle} cerrarHref={hrefPostulaciones(filtros, { abrir: null })} />
      )}
    </>
  );
}
