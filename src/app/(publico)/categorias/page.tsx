import type { Metadata } from "next";
import { TarjetasCategoria } from "@/components/publico/tarjetas-categoria";
import { resumenPublico } from "@/lib/queries/publico";

export const metadata: Metadata = {
  title: "Buscá profesionales por categoría",
  description: "Docentes, entrenadores y guardavidas verificados: elegí tu categoría para ver perfiles pensados para eso.",
};

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

export default async function Categorias() {
  const resumen = await resumenPublico();
  return (
    <>
      <section className="bg-[linear-gradient(180deg,#F4F3EF_0%,#FAFAF8_100%)] px-12 pt-14 pb-2 text-center max-[560px]:px-6">
        <h1 className="mb-2.5 text-[38px] leading-[1.15] font-semibold tracking-[-0.022em] text-balance text-tinta max-[560px]:text-[28px]">
          ¿Qué profesional estás buscando?
        </h1>
        <p className="mx-auto max-w-[56ch] text-base leading-[1.6] text-apagado">
          No es lo mismo cubrir una suplencia de aula que un turno de pileta. Elegí tu categoría para ver perfiles
          pensados para eso.
        </p>
      </section>
      <section className="flex-1 bg-superficie px-12 pt-10 pb-16 max-[560px]:px-6">
        <div className="mx-auto max-w-[1200px]">
          <TarjetasCategoria conteos={resumen.categorias} />
        </div>
      </section>
    </>
  );
}
