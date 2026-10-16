import Link from "next/link";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { BotonBusquedaUrgente } from "@/components/institucion/boton-busqueda-urgente";
import { BotonLink } from "@/components/ui/button";
import { requerirInstitucion } from "@/lib/auth";
import { interpretarBusqueda } from "@/lib/busqueda-ia";
import {
  filtrosActivos,
  hrefBuscador,
  hrefFrase,
  leerFiltros,
  RUTA_BUSCADOR,
  RUTA_RAPIDAS,
  TERMINOS_ROL,
} from "@/lib/filtros-docentes";
import {
  buscarDocentes,
  busquedaDeContexto,
  busquedasActivas,
  disciplinasParaFiltro,
  vocabularioBuscador,
} from "@/lib/queries/profesionales";
import { sedesDeInstitucion } from "@/lib/queries/sedes";
import { puntosDeReferencia } from "@/lib/sedes";
import { BarraBuscadorDocentes } from "./barra-buscador-docentes";
import { PaginacionLista } from "./paginacion-lista";
import { PanelFiltrosDocentes } from "./panel-filtros-docentes";
import { TarjetaDocente } from "./tarjeta-docente";

export type ParametrosDePagina = Promise<Record<string, string | string[] | undefined>>;

const fraseDe = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 200) ?? "";

/**
 * Buscar profesionales: el catálogo (/institucion/buscar-docentes) y su variante de suplencias rápidas
 * (/institucion/busquedas-rapidas) son la misma pantalla; cambia el universo y los títulos.
 */
export async function PantallaBuscadorDocentes({
  modo,
  searchParams,
}: {
  modo: "catalogo" | "rapidas";
  searchParams: ParametrosDePagina;
}) {
  const { usuario, institucion } = await requerirInstitucion();
  const sp = await searchParams;
  const rapidas = modo === "rapidas";
  const ruta = rapidas ? RUTA_RAPIDAS : RUTA_BUSCADOR;
  const rutaOtra = rapidas ? RUTA_BUSCADOR : RUTA_RAPIDAS;

  const vocabulario = await vocabularioBuscador();
  const frase = fraseDe(sp.q);
  const interpretacion = frase ? interpretarBusqueda(frase, vocabulario) : null;
  const inicial = leerFiltros(sp, interpretacion);

  // Una frase urgente ("necesito alguien para mañana mismo") lleva a las suplencias rápidas.
  if (!rapidas && sp.f !== "1" && interpretacion?.filtros.rapidas) {
    redirect(hrefFrase(RUTA_RAPIDAS, frase, inicial.busqueda));
  }

  // El id de la búsqueda viene de la URL: solo vale si es de esta institución.
  const contexto = inicial.busqueda ? await busquedaDeContexto(institucion.id, inicial.busqueda) : null;
  const filtros = contexto ? inicial : { ...inicial, busqueda: null };
  const activas = await busquedasActivas(institucion.id);
  const contextoId = contexto && activas.some((a) => a.id === contexto.id) ? contexto.id : null;
  // La cercanía se mide desde la sede de la búsqueda elegida o, sin búsqueda, desde todas las sedes (cada profesional, a la más cercana).
  const puntos = puntosDeReferencia(await sedesDeInstitucion(institucion.id), contexto?.sedeId, { nombre: institucion.nombre, lat: institucion.lat, lng: institucion.lng });

  const [resultado, disciplinas] = await Promise.all([
    buscarDocentes({ puntos, usuarioId: usuario.id, filtros, rapidas, contexto, activas }),
    disciplinasParaFiltro(filtros.categoria, filtros.disciplinas),
  ]);

  const hayFiltros = filtrosActivos(filtros) > 0 || !!filtros.frase;
  const limpiarHref = hrefFrase(ruta, "", filtros.busqueda);
  const sugerencias = [...new Set([...TERMINOS_ROL, ...vocabulario.disciplinas, ...vocabulario.zonas])];

  const titulo = rapidas
    ? filtros.soloFavoritos
      ? "Favoritos disponibles para suplencia"
      : "Suplencias"
    : filtros.soloFavoritos
      ? "Favoritos"
      : "Todos los profesionales";
  const bajada = rapidas
    ? "Profesionales verificados y disponibles ya para cubrir suplencias e imprevistos."
    : filtros.soloFavoritos
      ? "Profesionales que fuiste guardando para tener a mano."
      : "Catálogo completo de docentes, entrenadores y guardavidas de UNIDOAR.";

  const sinFavoritos = filtros.soloFavoritos && filtrosActivos(filtros) === 1 && resultado.total === 0;

  return (
    <div className="flex items-start gap-[22px] max-[760px]:flex-col max-[760px]:items-stretch">
      <PanelFiltrosDocentes
        ruta={ruta}
        filtros={filtros}
        disciplinas={disciplinas}
        zonasSugeridas={vocabulario.zonas}
        limpiarHref={limpiarHref}
        hayFiltros={hayFiltros}
      />

      <div className="min-w-0 flex-1">
        <EncabezadoPagina titulo={titulo} bajada={bajada} className="mb-3.5" />

        {contexto && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-caja border border-navy-100 bg-navy-50 px-4 py-3 text-[13px] leading-snug text-navy-700">
            <span>
              Ordenados según lo que pide tu búsqueda <b className="font-semibold">{contexto.puesto}</b>.
            </span>
            <Link
              href={hrefBuscador(ruta, filtros, { busqueda: null })}
              className="ml-auto font-semibold text-navy-700 underline"
            >
              Quitar
            </Link>
          </div>
        )}

        <BarraBuscadorDocentes
          ruta={ruta}
          rutaOtraPantalla={rutaOtra}
          rapidas={rapidas}
          filtros={filtros}
          leido={interpretacion ? { etiquetas: interpretacion.leido, reconocido: interpretacion.reconocido, sinEntender: interpretacion.sinEntender } : null}
          sugerencias={sugerencias}
          puedeOrdenarPorCercania={puntos.length > 0}
        />

        {resultado.total > 0 && (
          <p role="status" className="m-0 mb-3 text-[13px] text-apagado">
            {resultado.total === 1 ? "1 profesional" : `${resultado.total} profesionales`}
          </p>
        )}

        {resultado.docentes.length > 0 ? (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(258px,1fr))] gap-4 p-0 max-[620px]:grid-cols-1">
            {resultado.docentes.map((d) => (
              <li key={d.id}>
                <TarjetaDocente docente={d} activas={activas} contextoId={contextoId} rapidas={rapidas} />
              </li>
            ))}
          </ul>
        ) : sinFavoritos ? (
          <EstadoVacio
            titulo="Todavía no guardaste a nadie"
            texto="Tocá la estrella de un perfil para tenerlo a mano acá."
            accion={
              <BotonLink href={hrefBuscador(ruta, filtros, { soloFavoritos: false })} variante="secundario">
                Ver todos los profesionales
              </BotonLink>
            }
          />
        ) : (
          <EstadoVacio
            titulo="No hay profesionales con esos filtros"
            texto={
              rapidas
                ? "Probá con menos condiciones, o mirá el catálogo completo."
                : "Probá con menos condiciones, o ampliá la zona de búsqueda."
            }
            accion={
              <BotonLink href={limpiarHref} variante="secundario">
                Limpiar la búsqueda
              </BotonLink>
            }
          />
        )}

        <PaginacionLista
          pagina={resultado.pagina}
          paginas={resultado.paginas}
          hrefDe={(n) => hrefBuscador(ruta, filtros, { pagina: n })}
        />

        <BotonBusquedaUrgente />
      </div>
    </div>
  );
}
