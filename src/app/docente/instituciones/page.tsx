import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { BotonLink } from "@/components/ui/button";
import { InstitucionEstrella } from "@/components/docente/instituciones-acciones";
import { InstitucionesMapa, type PinInstitucion } from "@/components/docente/instituciones-mapa";
import { InstitucionesFiltros } from "@/components/instituciones/filtros";
import { TarjetaInstitucion } from "@/components/instituciones/tarjeta";
import { requerirDocente } from "@/lib/auth";
import { leerFiltrosInstituciones } from "@/lib/filtros-instituciones";
import { catalogoInstituciones, zonasDisponibles } from "@/lib/queries/instituciones";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Instituciones" };

type Params = Record<string, string | string[] | undefined>;

const PILDORA =
  "inline-flex items-center gap-1.5 rounded-full px-[15px] py-[7px] text-[13px] leading-none font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";

export default async function InstitucionesDocentePage({ searchParams }: { searchParams: Promise<Params> }) {
  const { usuario } = await requerirDocente();
  const crudo = await searchParams;
  const f = leerFiltrosInstituciones(crudo);
  const vista = f.vista ?? "lista";

  const [instituciones, zonas] = await Promise.all([
    catalogoInstituciones(usuario.id, {
      texto: f.q ?? "",
      tipo: f.tipo ?? "",
      zona: f.zona ?? "",
      soloFavoritas: f.favoritas === "1",
    }),
    zonasDisponibles(),
  ]);

  const hrefVista = (v: "lista" | "mapa") => {
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.tipo) p.set("tipo", f.tipo);
    if (f.zona) p.set("zona", f.zona);
    if (f.favoritas) p.set("favoritas", "1");
    if (v === "mapa") p.set("vista", "mapa");
    const qs = p.toString();
    return qs ? `/docente/instituciones?${qs}` : "/docente/instituciones";
  };

  const hayFiltros = !!(f.q || f.tipo || f.zona || f.favoritas);
  const pines: PinInstitucion[] = instituciones.flatMap((i) =>
    i.lat != null && i.lng != null
      ? [
          {
            id: i.id,
            slug: i.slug,
            nombre: i.nombre,
            tipo: i.tipo,
            zona: i.zona,
            logoUrl: i.logoUrl,
            lat: i.lat,
            lng: i.lng,
            busquedasActivas: i.busquedasActivas,
            favorita: i.favorita,
            verificada: i.verificada,
          },
        ]
      : [],
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Instituciones"
        bajada="Colegios, clubes y jardines que ya usan UNIDOAR. Guardá los que te interesan y mandales tu CV."
      />

      <InstitucionesFiltros
        valores={{ q: f.q ?? "", tipo: f.tipo ?? "", zona: f.zona ?? "", favoritas: f.favoritas === "1" }}
        zonas={zonas}
      />

      <nav aria-label="Vista" className="mb-[18px] flex w-max max-w-full gap-1.5 rounded-full border border-borde bg-white p-1">
        <Link
          href={hrefVista("lista")}
          aria-current={vista === "lista" ? "page" : undefined}
          className={cn(PILDORA, vista === "lista" ? "bg-navy-700 text-white" : "text-apagado hover:text-tinta")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
            <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
          </svg>
          Lista
        </Link>
        <Link
          href={hrefVista("mapa")}
          aria-current={vista === "mapa" ? "page" : undefined}
          className={cn(PILDORA, vista === "mapa" ? "bg-navy-700 text-white" : "text-apagado hover:text-tinta")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
            <path d="M9 3L3 5.5v15L9 18l6 3 6-2.5v-15L15 6z" />
            <path d="M9 3v15M15 6v15" />
          </svg>
          Mapa
        </Link>
      </nav>

      {instituciones.length === 0 ? (
        <EstadoVacio
          titulo={
            f.favoritas && !f.q && !f.tipo && !f.zona
              ? "Todavía no guardaste ninguna institución"
              : hayFiltros
                ? "No encontramos instituciones con esos filtros"
                : "Todavía no hay instituciones"
          }
          texto={
            f.favoritas && !f.q && !f.tipo && !f.zona
              ? "Tocá “Guardar” en las que te interesen y las vas a tener juntas acá."
              : hayFiltros
                ? "Probá con otro nombre, otro tipo o quitá algún filtro."
                : "Apenas se sumen instituciones las vas a ver acá."
          }
          accion={
            hayFiltros ? (
              <BotonLink href="/docente/instituciones" variante="secundario">
                Ver todas las instituciones
              </BotonLink>
            ) : undefined
          }
        />
      ) : vista === "mapa" ? (
        <InstitucionesMapa pines={pines} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-4 max-[560px]:grid-cols-1">
          {instituciones.map((i) => (
            <TarjetaInstitucion
              key={i.id}
              i={i}
              href={`/docente/instituciones/${i.slug}`}
              estrella={<InstitucionEstrella institucionId={i.id} favorita={i.favorita} nombre={i.nombre} />}
            />
          ))}
        </div>
      )}
    </>
  );
}
