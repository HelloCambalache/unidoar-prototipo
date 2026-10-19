import Link from "next/link";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { BotonFavorito } from "@/components/docente/boton-favorito";
import { MapaOfertas, type PinOferta } from "@/components/docente/mapa-ofertas";
import { TarjetaOfertaApp } from "@/components/docente/tarjeta-oferta-app";
import { BannerBuscador } from "@/components/oportunidades/banner-buscador";
import { ControlesBuscador } from "@/components/oportunidades/controles-buscador";
import { BotonLink } from "@/components/ui/button";
import { requerirDocente } from "@/lib/auth";
import { hrefOportunidades, RADIO_MAX, urgentesPrimero, type FiltrosOportunidades } from "@/lib/oportunidades";
import { listarOportunidades } from "@/lib/queries/oportunidades";
import { filtrosConFrase } from "@/lib/queries/oportunidades-frase";
import { cn } from "@/lib/utils";

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
  // `filtros` es lo que está en la URL; la pantalla de rápidas agrega el suyo solo para consultar.
  const { filtros: delUsuario, lectura } = await filtrosConFrase(params);
  const filtros: FiltrosOportunidades = { ...delUsuario, ...(modo === "rapidas" && { rapidas: undefined }) };
  const consulta: FiltrosOportunidades = modo === "rapidas" ? { ...filtros, rapidas: "1" } : filtros;

  const { ofertas, radio, conUbicacion } = await listarOportunidades(docente, usuario.id, consulta);
  const vista = filtros.vista === "mapa" ? "mapa" : "lista";
  const hayFiltros = Object.entries(filtros).some(([clave, valor]) => clave !== "vista" && valor !== undefined);

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

  const pines: PinOferta[] = ofertas.flatMap((o) =>
    o.institucion.lat != null && o.institucion.lng != null
      ? [
          {
            id: o.id,
            puesto: o.puesto,
            institucion: o.institucion.nombre,
            logoUrl: o.institucion.logoUrl,
            zona: o.zona,
            horario: o.horario,
            categoria: o.categoria,
            rapida: o.rapida,
            lat: o.institucion.lat,
            lng: o.institucion.lng,
          },
        ]
      : [],
  );
  const centro = docente.lat != null && docente.lng != null ? { lat: docente.lat, lng: docente.lng } : null;

  return (
    <>
      <BannerBuscador titulo={titulo} bajada={bajada} />
      <ControlesBuscador
        base={base}
        filtros={filtros}
        radio={radio}
        radioPorDefecto={docente.radioKm}
        conUbicacion={conUbicacion}
        modo={modo}
        lectura={lectura}
        vistaNav={
        <nav aria-label="Vista" className="flex w-max max-w-full gap-1 rounded-full bg-[#E9E7E1] p-1">
          <EnlaceVista href={hrefOportunidades(base, filtros, { vista: "lista" })} activa={vista === "lista"}>
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
            </svg>
            Lista
          </EnlaceVista>
          <EnlaceVista href={hrefOportunidades(base, filtros, { vista: "mapa" })} activa={vista === "mapa"}>
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
              <path d="M9 3L3 5.5v15L9 18l6 3 6-2.5v-15L15 6z" />
              <path d="M9 3v15M15 6v15" />
            </svg>
            Mapa
          </EnlaceVista>
        </nav>
        }
      >

        {n === 0 ? (
          <EstadoVacio
            titulo={hayFiltros ? "Ninguna búsqueda coincide con estos filtros" : "Todavía no hay búsquedas para vos"}
            texto={
              hayFiltros || (conUbicacion && radio < RADIO_MAX)
                ? "Probá ampliar el rango de búsqueda o sacar algún filtro."
                : "Cuando una institución publique una búsqueda que te sirva, la vas a ver acá."
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

function EnlaceVista({ href, activa, children }: { href: string; activa: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={activa ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-[13px] leading-none font-semibold transition-colors",
        activa ? "bg-white text-navy-900 shadow-[0_1px_3px_rgba(4,11,53,.12)] hover:text-navy-900" : "text-apagado hover:text-tinta",
      )}
    >
      {children}
    </Link>
  );
}
