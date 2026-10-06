import type { Metadata } from "next";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { MuroCuenta } from "@/components/publico/muro-cuenta";
import { sesionPublica } from "@/components/publico/sesion";
import { TarjetaInstitucion } from "@/components/publico/tarjeta-institucion";
import { listarInstitucionesPublicas } from "@/lib/queries/publico";

export const metadata: Metadata = {
  title: "Instituciones",
  description:
    "Colegios, clubes, jardines y gimnasios que ya contratan por UNIDOAR. Entrá a cualquiera para ver qué están buscando.",
};

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

export default async function Instituciones() {
  const [instituciones, sesion] = await Promise.all([listarInstitucionesPublicas(), sesionPublica()]);

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

        {instituciones.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no hay instituciones para mostrar"
            texto="Las instituciones que se sumen y se verifiquen aparecen acá."
          />
        ) : (
          <ul className="m-0 grid list-none grid-cols-3 gap-[18px] p-0 max-[760px]:grid-cols-2 max-[700px]:grid-cols-1">
            {instituciones.map((i) => (
              <li key={i.id} className="grid">
                <TarjetaInstitucion institucion={i} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
