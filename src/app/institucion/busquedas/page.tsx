import type { Metadata } from "next";
import Link from "next/link";
import { cerrarBusqueda, reabrirBusqueda } from "@/app/actions/busquedas";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { TarjetaMetrica } from "@/components/app/tarjeta-metrica";
import { BotonAccion } from "@/components/institucion/boton-accion";
import { FiltrosBusquedas } from "@/components/institucion/filtros-busquedas";
import { EstadoBusqueda } from "@/components/institucion/insignias-busqueda";
import { BotonLink } from "@/components/ui/button";
import { Pestanas } from "@/components/ui/pestanas";
import { Tabla } from "@/components/ui/tabla";
import { requerirInstitucion } from "@/lib/auth";
import { ESTADOS_FILTRO, plural, type EstadoFiltro } from "@/lib/busquedas";
import { estadisticasInstitucion, listarBusquedas } from "@/lib/queries/busquedas";

export const metadata: Metadata = { title: "Publicaciones" };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Publicaciones({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { institucion } = await requerirInstitucion();
  const sp = await searchParams;
  const pestana = uno(sp.tab) === "cerradas" ? "cerradas" : "activas";
  const q = uno(sp.q).trim().slice(0, 100);
  const estadoCrudo = uno(sp.estado);
  const estado: EstadoFiltro = ESTADOS_FILTRO.find((e) => e === estadoCrudo) ?? "todos";
  const publicada = sp.publicada === undefined ? null : Number(uno(sp.publicada));

  const [est, filas] = await Promise.all([
    estadisticasInstitucion(institucion.id),
    listarBusquedas(institucion.id, { pestana, q, estado }),
  ]);
  const hayFiltros = q !== "" || (pestana === "activas" && estado !== "todos");

  return (
    <>
      <EncabezadoPagina
        titulo="Publicaciones"
        className="mb-1.5"
        acciones={
          <BotonLink href="/institucion/publicar" variante="cta" tamano="lg">
            Publicar
          </BotonLink>
        }
      />

      {publicada !== null && Number.isFinite(publicada) && (
        <p role="status" className="mt-3 mb-0 rounded-lg bg-verde-tint px-4 py-3 text-[13.5px] leading-normal text-verde">
          Tu búsqueda quedó publicada.{" "}
          {publicada > 0
            ? `Les avisamos a ${plural(publicada, "profesional que coincide", "profesionales que coinciden")} con tu búsqueda.`
            : "Los profesionales la van a ver cuando entren a buscar trabajo en tu zona."}
        </p>
      )}

      <div className="mt-[18px] grid grid-cols-4 gap-3 max-[760px]:grid-cols-2 max-[700px]:grid-cols-1">
        <TarjetaMetrica
          etiqueta="Búsquedas activas"
          valor={est.activas}
          nota={
            est.rapidas > 0
              ? `${est.rapidas} ${est.rapidas === 1 ? "es rápida" : "son rápidas"}`
              : "ninguna urgente"
          }
        />
        <TarjetaMetrica
          etiqueta="Postulantes en proceso"
          valor={est.enProceso}
          nota={`${est.nuevos} ${est.nuevos === 1 ? "nuevo" : "nuevos"} sin revisar`}
        />
        <TarjetaMetrica etiqueta="En entrevista" valor={est.entrevistas} nota={`${est.ofertas} con oferta enviada`} />
        <TarjetaMetrica
          etiqueta="Cerradas"
          valor={est.cerradas}
          nota={
            est.cerradas === 0
              ? "todavía ninguna"
              : est.cerradasConContratacion > 0
                ? `${est.cerradasConContratacion} con contratación confirmada`
                : "sin contratación registrada"
          }
        />
      </div>

      <div className="my-4">
        <FiltrosBusquedas pestana={pestana} q={q} estado={estado} hayPausadas={est.pausadas > 0} />
      </div>
      <Pestanas
        className="mb-4"
        activa={pestana}
        items={[
          { clave: "activas", etiqueta: "Activas", href: "/institucion/busquedas", cantidad: est.activas },
          { clave: "cerradas", etiqueta: "Cerradas", href: "/institucion/busquedas?tab=cerradas", cantidad: est.cerradas },
        ]}
      />

      {filas.length === 0 ? (
        hayFiltros ? (
          <EstadoVacio titulo="Ninguna búsqueda coincide con los filtros" texto="Probá con otro texto o mostrando todos los estados." />
        ) : pestana === "activas" ? (
          <EstadoVacio
            titulo="Todavía no tenés búsquedas abiertas"
            texto="Publicá una búsqueda y los profesionales de tu zona la ven en el momento."
            accion={
              <BotonLink href="/institucion/publicar" variante="cta">
                Publicar una búsqueda
              </BotonLink>
            }
          />
        ) : (
          <EstadoVacio titulo="Todavía no cerraste ninguna búsqueda" texto="Cuando cubras un cargo y cierres la búsqueda, queda guardada acá." />
        )
      ) : pestana === "activas" ? (
        <Tabla>
          <thead>
            <tr>
              <th>Puesto</th>
              <th>Postulantes</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/institucion/postulantes?busqueda=${b.id}`} className="font-semibold text-tinta hover:text-navy-700">
                    {b.puesto}
                  </Link>
                  <div className="mt-0.5 text-xs leading-snug text-apagado">
                    {b.meta} · publicada {b.publicada}
                  </div>
                </td>
                <td className="whitespace-nowrap">
                  {b.postulantes}
                  {b.nuevos > 0 && <span className="ml-1.5 text-xs font-semibold text-naranja">{b.nuevos} nuevos</span>}
                </td>
                <td>
                  <EstadoBusqueda b={b} />
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <BotonLink href={`/institucion/postulantes?busqueda=${b.id}`} variante="secundario" tamano="sm">
                      Ver postulantes
                    </BotonLink>
                    <BotonLink href={`/institucion/publicar?editar=${b.id}`} variante="fantasma" tamano="sm">
                      Editar
                    </BotonLink>
                    <BotonAccion
                      accion={cerrarBusqueda.bind(null, b.id)}
                      exito="Búsqueda cerrada"
                      confirmar={`¿Cerrar «${b.puesto}»? Los postulantes se conservan y podés reabrirla cuando quieras.`}
                    >
                      Cerrar
                    </BotonAccion>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Puesto</th>
              <th>Profesional contratado</th>
              <th>Duración</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/institucion/postulantes?busqueda=${b.id}`} className="font-semibold text-tinta hover:text-navy-700">
                    {b.puesto}
                  </Link>
                  <div className="mt-0.5 text-xs leading-snug text-apagado">{b.meta}</div>
                </td>
                <td>{b.docenteContratado ?? <span className="text-sutil">Sin contratación</span>}</td>
                <td className="whitespace-nowrap">{b.duracion ?? "—"}</td>
                <td>
                  <div className="flex justify-end gap-2">
                    <BotonLink href={`/institucion/postulantes?busqueda=${b.id}`} variante="secundario" tamano="sm">
                      Ver postulantes
                    </BotonLink>
                    <BotonAccion accion={reabrirBusqueda.bind(null, b.id)} exito="Búsqueda reabierta">
                      Reabrir
                    </BotonAccion>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </>
  );
}
