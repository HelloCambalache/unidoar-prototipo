import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { SelectorDeVista } from "@/components/app/selector-vista";
import { BotonLink } from "@/components/ui/button";
import { InstitucionEstrella } from "@/components/docente/instituciones-acciones";
import { InstitucionesMapa } from "@/components/docente/instituciones-mapa";
import { InstitucionesFiltros } from "@/components/instituciones/filtros";
import { pinesDeInstituciones } from "@/components/instituciones/pines";
import { TarjetaInstitucion } from "@/components/instituciones/tarjeta";
import { requerirDocente } from "@/lib/auth";
import { leerFiltrosInstituciones } from "@/lib/filtros-instituciones";
import { catalogoInstituciones, zonasDisponibles } from "@/lib/queries/instituciones";

export const metadata: Metadata = { title: "Instituciones" };

type Params = Record<string, string | string[] | undefined>;

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
  const pines = pinesDeInstituciones(instituciones, (i) => `/docente/instituciones/${i.slug}`);

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

      <SelectorDeVista vista={vista} hrefLista={hrefVista("lista")} hrefMapa={hrefVista("mapa")} className="mb-[18px] self-end" />

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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 max-[560px]:grid-cols-1">
          {instituciones.map((i) => (
            <TarjetaInstitucion
              key={i.id}
              app
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
