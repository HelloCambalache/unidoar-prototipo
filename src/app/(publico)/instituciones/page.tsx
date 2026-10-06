import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { InstitucionesFiltros } from "@/components/instituciones/filtros";
import { TarjetaInstitucion } from "@/components/instituciones/tarjeta";
import { MuroCuenta } from "@/components/publico/muro-cuenta";
import { sesionPublica } from "@/components/publico/sesion";
import { BotonLink } from "@/components/ui/button";
import { leerFiltrosInstituciones } from "@/lib/filtros-instituciones";
import { catalogoInstituciones, zonasDisponibles } from "@/lib/queries/instituciones";

export const metadata: Metadata = {
  title: "Instituciones",
  description:
    "Colegios, clubes, jardines y gimnasios que ya contratan por UNIDOAR. Entrá a cualquiera para ver qué están buscando.",
};

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function Instituciones({ searchParams }: { searchParams: Params }) {
  const f = leerFiltrosInstituciones(await searchParams);
  const [instituciones, zonas, sesion] = await Promise.all([
    catalogoInstituciones(null, { texto: f.q ?? "", tipo: f.tipo ?? "", zona: f.zona ?? "", soloFavoritas: false }),
    zonasDisponibles(),
    sesionPublica(),
  ]);
  const hayFiltros = !!(f.q || f.tipo || f.zona);

  return (
    <div className="flex-1 bg-app px-12 py-9 max-[860px]:px-4 max-[860px]:py-5">
      <div className="mx-auto max-w-[1320px]">
        <h1 className="mb-1.5 font-display text-[34px] leading-[1.2] font-bold tracking-[-0.02em] text-tinta max-[560px]:text-[28px]">
          Instituciones en UNIDOAR
        </h1>
        <p className="mb-[22px] text-[15px] leading-normal text-apagado">
          Colegios, clubes, jardines y gimnasios que ya contratan por acá. Entrá a cualquiera para ver qué están
          buscando.
        </p>

        {!sesion.rol && (
          <MuroCuenta
            titulo="Creá tu cuenta y mandales tu CV"
            bajada="Gratis para docentes. Guardás las instituciones que te interesan y te avisamos cuando publican."
          />
        )}

        <InstitucionesFiltros
          valores={{ q: f.q ?? "", tipo: f.tipo ?? "", zona: f.zona ?? "", favoritas: false }}
          zonas={zonas}
          conFavoritas={false}
        />

        {instituciones.length === 0 ? (
          <EstadoVacio
            titulo={hayFiltros ? "Ninguna institución coincide con esos filtros" : "Todavía no hay instituciones para mostrar"}
            texto={
              hayFiltros
                ? "Probá con otro tipo o con otra zona."
                : "Las instituciones que se sumen y se verifiquen aparecen acá."
            }
            accion={
              hayFiltros ? (
                <BotonLink href="/instituciones" variante="secundario" tamano="sm">
                  Ver todas las instituciones
                </BotonLink>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-[18px] max-[560px]:grid-cols-1">
            {instituciones.map((i) => (
              <TarjetaInstitucion
                key={i.id}
                i={i}
                href={`/instituciones/${i.slug}`}
                estrella={sesion.rol ? undefined : <EstrellaRegistro nombre={i.nombre} />}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** La estrella de guardar para una visita: lleva a crear la cuenta, que es lo que hace falta para guardar. */
function EstrellaRegistro({ nombre }: { nombre: string }) {
  return (
    <Link
      href="/registro"
      aria-label={`Creá tu cuenta para guardar: ${nombre}`}
      title="Creá tu cuenta para guardar"
      className="flex-none rounded-md px-1 text-base leading-none text-[#D8D6CE] transition-colors hover:text-[#F0B400]/70 focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
    >
      ★
    </Link>
  );
}
