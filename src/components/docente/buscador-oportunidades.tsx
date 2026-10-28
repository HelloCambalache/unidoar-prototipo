import Link from "next/link";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { SelectorDeVista } from "@/components/app/selector-vista";
import { BotonFavorito } from "@/components/docente/boton-favorito";
import { MapaOfertas } from "@/components/docente/mapa-ofertas";
import { TarjetaOfertaApp } from "@/components/docente/tarjeta-oferta-app";
import { BannerBuscador } from "@/components/oportunidades/banner-buscador";
import { ControlesBuscador } from "@/components/oportunidades/controles-buscador";
import { pinesDeOfertas } from "@/components/oportunidades/pines";
import { BotonLink } from "@/components/ui/button";
import { requerirDocente } from "@/lib/auth";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import {
  CATEGORIA_TODAS,
  hrefOportunidades,
  RADIO_MAX,
  urgentesPrimero,
  type FiltrosOportunidades,
} from "@/lib/oportunidades";
import { filtrosConFrase, listarOportunidadesConFrase } from "@/lib/queries/oportunidades-frase";

const BASES = {
  todas: "/docente/oportunidades",
  rapidas: "/docente/busquedas-rapidas",
} as const;

/**
 * Pantalla de búsqueda de trabajo del docente. "Buscar trabajo" y "Búsquedas rápidas" son la misma
 * pantalla: la segunda fija `rapidas` y no ofrece ese filtro.
 */
export async function BuscadorOportunidades({
  modo,
  params,
}: {
  modo: keyof typeof BASES;
  params: Record<string, string | string[] | undefined>;
}) {
  const { usuario, docente } = await requerirDocente();
  const base = BASES[modo];
  // `pedidos` es lo que está en la URL; la pantalla de rápidas agrega el suyo solo para consultar.
  const { filtros: delUsuario, lectura } = await filtrosConFrase(params);
  const pedidos: FiltrosOportunidades = { ...delUsuario, ...(modo === "rapidas" && { rapidas: undefined }) };
  const consulta: FiltrosOportunidades = modo === "rapidas" ? { ...pedidos, rapidas: "1" } : pedidos;

  const { ofertas, radio, conUbicacion, sinResultadosConTexto } = await listarOportunidadesConFrase(docente, usuario.id, consulta, lectura);
  // Si el texto de la frase no encontró nada junto con los filtros, se muestran los filtros solos y la pantalla lo refleja y lo avisa.
  const filtros: FiltrosOportunidades = sinResultadosConTexto ? { ...pedidos, q: lectura?.qSinTexto } : pedidos;
  const lecturaVista = lectura && sinResultadosConTexto ? { ...lectura, texto: "", sinResultadosConTexto } : lectura;
  const vista = filtros.vista === "mapa" ? "mapa" : "lista";
  const hayFiltros = Object.entries(filtros).some(([clave, valor]) => clave !== "vista" && valor !== undefined);
  // Sin elegir categoría se muestran las de la suya: se avisa y se ofrece ver las de todas (`?categoria=todas`).
  const soloMiCategoria = filtros.categoria === undefined;
  const hrefTodasLasCategorias = hrefOportunidades(base, filtros, { categoria: CATEGORIA_TODAS });
  const miCategoria = CATEGORIA_INFO[docente.categoria].plural;

  const rapidas = modo === "rapidas";
  const n = ofertas.length;
  const titulo =
    n === 0
      ? rapidas
        ? "No hay búsquedas rápidas para mostrar"
        : "No hay búsquedas para mostrar"
      : rapidas
        ? `${n} ${n === 1 ? "búsqueda rápida" : "búsquedas rápidas"} cerca tuyo`
        : `${n} ${n === 1 ? "búsqueda nueva" : "búsquedas nuevas"} cerca tuyo`;
  const perfilDocente = [docente.asignaturas.join(", "), docente.zonas.join(", ")].filter(Boolean).join(" · ");
  const bajada = rapidas
    ? "Suplencias y reemplazos urgentes: respondé dentro del plazo para quedarte con el puesto."
    : perfilDocente || "Completá tus asignaturas y zonas en el perfil para encontrar búsquedas que te sirvan.";

  const pines = pinesDeOfertas(ofertas);
  const centro = docente.lat != null && docente.lng != null ? { lat: docente.lat, lng: docente.lng } : null;

  return (
    <>
      <BannerBuscador titulo={titulo} bajada={bajada} />
      <ControlesBuscador
        base={base}
        filtros={filtros}
        radio={radio}
        radioPorDefecto={docente.radioKm}
        categoriaPropia={docente.categoria}
        conMaterias={docente.asignaturas.length > 0}
        conUbicacion={conUbicacion}
        modo={modo}
        lectura={lecturaVista}
        vistaNav={
          <SelectorDeVista
            vista={vista}
            hrefLista={hrefOportunidades(base, filtros, { vista: "lista" })}
            hrefMapa={hrefOportunidades(base, filtros, { vista: "mapa" })}
            reemplazar
          />
        }
      >
        {soloMiCategoria && n > 0 && (
          <p className="mt-0 mb-4 text-[13.5px] leading-normal text-apagado">
            Te mostramos las búsquedas de <strong className="font-semibold text-tinta-2">{miCategoria}</strong>, tu categoría.{" "}
            <Link href={hrefTodasLasCategorias} replace scroll={false} className="font-semibold text-rosa underline">
              Ver las de todas las categorías
            </Link>
          </p>
        )}
        {n === 0 ? (
          <EstadoVacio
            titulo={hayFiltros ? "Ninguna búsqueda coincide con estos filtros" : "Todavía no hay búsquedas para vos"}
            texto={
              hayFiltros || (conUbicacion && radio < RADIO_MAX)
                ? "Probá ampliar el rango de búsqueda o sacar algún filtro."
                : `Cuando una institución publique una búsqueda de ${miCategoria} que te sirva, la vas a ver acá.`
            }
            accion={
              // El interruptor «Solo mi materia» puede dejar la lista vacía: se ofrece sacarlo antes que ampliar la categoría.
              filtros.materia ? (
                <BotonLink variante="secundario" tamano="sm" href={hrefOportunidades(base, filtros, { materia: null })}>
                  Ver también las de otras materias
                </BotonLink>
              ) : soloMiCategoria ? (
                <BotonLink variante="secundario" tamano="sm" href={hrefTodasLasCategorias}>
                  Ver las de todas las categorías
                </BotonLink>
              ) : undefined
            }
          />
        ) : vista === "mapa" ? (
          pines.length > 0 || centro ? (
            <MapaOfertas pines={pines} centro={centro} radioKm={conUbicacion && radio < RADIO_MAX ? radio : null} />
          ) : (
            <EstadoVacio
              titulo="Estas búsquedas todavía no tienen ubicación en el mapa"
              texto="Podés verlas en la lista."
              accion={
                <BotonLink variante="secundario" tamano="sm" href={hrefOportunidades(base, filtros, { vista: "lista" })}>
                  Ver la lista
                </BotonLink>
              }
            />
          )
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(270px,1fr))] items-stretch gap-4 p-0 max-[620px]:grid-cols-1">
            {/* Las urgentes abiertas (sin postulación) van primero; el resto conserva el orden de la consulta. */}
            {urgentesPrimero(ofertas).map((o) => (
              <li key={o.id} className="flex *:w-full">
                <TarjetaOfertaApp
                  oferta={o}
                  href={`/docente/oferta/${o.id}`}
                  estrella={<BotonFavorito busquedaId={o.id} favorita={o.favorita} puesto={o.puesto} />}
                />
              </li>
            ))}
          </ul>
        )}
      </ControlesBuscador>
    </>
  );
}
