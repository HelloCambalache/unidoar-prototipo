import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { SelectorDeVista } from "@/components/app/selector-vista";
import { MapaOfertas } from "@/components/docente/mapa-ofertas";
import { TarjetaOfertaApp } from "@/components/docente/tarjeta-oferta-app";
import { BannerBuscador } from "@/components/oportunidades/banner-buscador";
import { ControlesBuscador } from "@/components/oportunidades/controles-buscador";
import { pinesDeOfertas } from "@/components/oportunidades/pines";
import { Paginacion } from "@/components/publico/paginacion";
import { sesionPublica, type SesionPublica } from "@/components/publico/sesion";
import { BotonLink } from "@/components/ui/button";
import { hrefOportunidades, RADIO_MAX, urgentesPrimero } from "@/lib/oportunidades";
import { plural, RUTA_REGISTRO_DOCENTE } from "@/lib/publico";
import { listarOportunidades, type OfertaListada } from "@/lib/queries/oportunidades";
import { filtrosConFrase } from "@/lib/queries/oportunidades-frase";

export const metadata: Metadata = {
  title: "Búsquedas abiertas",
  description:
    "Todo lo que las instituciones están buscando ahora mismo: docentes, entrenadores y guardavidas. Mirá sin cuenta; para postularte necesitás una.",
};

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

const POR_PAGINA = 24;
const BASE = "/buscar-trabajo";

type Params = Promise<Record<string, string | string[] | undefined>>;
const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A dónde lleva cada tarjeta (y el botón de cada pin del mapa) según quién mira: una visita al registro, un docente a la oferta de su panel. */
function destino(sesion: SesionPublica, o: OfertaListada) {
  if (!sesion.rol) return { href: "/registro", etiqueta: "Postularme" };
  if (sesion.rol === "docente") return { href: `/docente/oferta/${o.id}`, etiqueta: "Ver oferta" };
  return { href: `/instituciones/${o.institucion.slug}`, etiqueta: "Ver institución" };
}

/** Misma pantalla que "Buscar trabajo" del área del profesional (banner, filtros, lista o mapa y tarjetas); sin cuenta no hay distancia ni favoritas. */
export default async function BuscarTrabajo({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  // Sin cuenta no hay ubicación ni favoritas: esos parámetros de la URL se ignoran. La vista (lista o mapa) sí se respeta.
  const { filtros: delUsuario, lectura } = await filtrosConFrase(sp, { publico: true });
  const filtros = { ...delUsuario, radio: undefined, favoritos: undefined };
  const vista = filtros.vista === "mapa" ? "mapa" : "lista";
  const pedida = Math.max(1, Number.parseInt(primero(sp.pagina) ?? "1", 10) || 1);

  const [{ ofertas }, sesion] = await Promise.all([listarOportunidades(null, null, filtros), sesionPublica()]);

  const total = ofertas.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(pedida, paginas);
  // Las urgentes abiertas van primero, igual que en Buscar trabajo de adentro (antes de paginar).
  const ordenadas = urgentesPrimero(ofertas);
  const visibles = ordenadas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const filtrando = Object.entries(filtros).some(([clave, valor]) => clave !== "vista" && valor !== undefined);
  const pines = pinesDeOfertas(ordenadas, (o) => destino(sesion, o));

  return (
    <div className="flex-1 px-12 py-9 max-[860px]:px-4 max-[860px]:py-5">
      <div className="mx-auto max-w-[1320px]">
        <BannerBuscador
          titulo="Búsquedas abiertas"
          bajada="Todo lo que las instituciones están buscando ahora mismo. Mirá sin cuenta; para postularte necesitás una."
          acciones={
            sesion.rol ? undefined : (
              <>
                <BotonLink
                  href="/ingresar"
                  variante="secundario"
                  className="border-white/35 bg-transparent text-white hover:border-white/60 hover:bg-white/10 hover:text-white"
                >
                  Ya tengo cuenta
                </BotonLink>
                <BotonLink href={RUTA_REGISTRO_DOCENTE} variante="cta">
                  Crear cuenta gratis
                </BotonLink>
              </>
            )
          }
        />

        <ControlesBuscador
          base={BASE}
          filtros={filtros}
          radio={RADIO_MAX}
          radioPorDefecto={RADIO_MAX}
          conUbicacion={false}
          modo="todas"
          publico
          lectura={lectura}
          vistaNav={
            <SelectorDeVista
              vista={vista}
              hrefLista={hrefOportunidades(BASE, filtros, { vista: "lista" })}
              hrefMapa={hrefOportunidades(BASE, filtros, { vista: "mapa" })}
              reemplazar
            />
          }
        >
          <p aria-live="polite" className="mb-4 text-[13px] text-apagado">
            {plural(total, "búsqueda abierta", "búsquedas abiertas")}
            {filtros.q ? ` para “${filtros.q}”` : ""}
          </p>

          {total === 0 ? (
            <EstadoVacio
              titulo={filtrando ? "Ninguna búsqueda coincide con esos filtros" : "Todavía no hay búsquedas abiertas"}
              texto={
                filtrando
                  ? "Probá con otra palabra o sacá algún filtro para ver más resultados."
                  : "Cuando una institución publique una búsqueda, la vas a ver acá."
              }
              accion={
                filtrando ? (
                  <BotonLink href={BASE} variante="secundario" tamano="sm">
                    Ver todas las búsquedas
                  </BotonLink>
                ) : undefined
              }
            />
          ) : vista === "mapa" ? (
            pines.length > 0 ? (
              <MapaOfertas pines={pines} centro={null} radioKm={null} />
            ) : (
              <EstadoVacio
                titulo="Estas búsquedas todavía no tienen ubicación en el mapa"
                texto="Podés verlas en la lista."
                accion={
                  <BotonLink variante="secundario" tamano="sm" href={hrefOportunidades(BASE, filtros, { vista: "lista" })}>
                    Ver la lista
                  </BotonLink>
                }
              />
            )
          ) : (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(270px,1fr))] items-stretch gap-4 p-0 max-[620px]:grid-cols-1">
              {visibles.map((o) => {
                const { href, etiqueta } = destino(sesion, o);
                return (
                  <li key={o.id} className="flex *:w-full">
                    <TarjetaOfertaApp
                      oferta={o}
                      href={href}
                      etiqueta={etiqueta}
                      estrella={sesion.rol ? undefined : <EstrellaRegistro puesto={o.puesto} />}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {vista === "lista" && (
            <Paginacion
              base={BASE}
              parametros={{
                q: filtros.q,
                categoria: filtros.categoria,
                nivel: filtros.nivel,
                turno: filtros.turno,
                tipo: filtros.tipo,
                rapidas: filtros.rapidas,
                verificadas: filtros.verificadas,
              }}
              pagina={pagina}
              paginas={paginas}
            />
          )}
        </ControlesBuscador>
      </div>
    </div>
  );
}

/** La estrella de favoritos para una visita: lleva a crear la cuenta, que es lo que hace falta para guardar. */
function EstrellaRegistro({ puesto }: { puesto: string }) {
  return (
    <Link
      href="/registro"
      aria-label={`Creá tu cuenta para guardar en favoritos: ${puesto}`}
      title="Creá tu cuenta para guardar en favoritos"
      className="relative z-10 flex-none rounded-md px-1 text-base leading-none text-[#D8D6CE] transition-colors hover:text-[#F0B400]/70 focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
    >
      ★
    </Link>
  );
}
