import Link from "next/link";
import type { FundadoraPublica } from "@/lib/queries/publico";
import { LogoInstitucion } from "./logo-institucion";

/**
 * «Instituciones fundadoras» de la portada: las primeras instituciones que se sumaron (las que tienen el Plan Fundador y están verificadas), con su
 * logo y su nombre, una por una y no en una tira que pasa. Es uno de los beneficios de ser fundadora. Sin ninguna, no se dibuja.
 */
export function FundadorasHome({ fundadoras }: { fundadoras: FundadoraPublica[] }) {
  if (fundadoras.length === 0) return null;
  return (
    <section aria-labelledby="fundadoras-titulo" className="bg-lienzo px-12 py-14 max-[900px]:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-2 flex items-center gap-[9px]">
          <span aria-hidden className="size-2 rounded-full bg-ambar" />
          <span className="text-xs leading-none font-semibold tracking-[.09em] text-naranja-ink uppercase">Estuvieron desde el día uno</span>
        </div>
        <h2
          id="fundadoras-titulo"
          className="font-display mb-6 text-[28px] leading-tight font-semibold tracking-[-0.025em] text-navy-900 max-[560px]:text-[24px]"
        >
          Instituciones fundadoras
        </h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3.5 p-0">
          {fundadoras.map((f) => (
            <li key={f.id}>
              <Link
                href={`/instituciones/${f.slug}`}
                className="flex items-center gap-3 rounded-tarjeta bg-white p-3.5 shadow-tarjeta transition-shadow hover:shadow-tarjeta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
              >
                <LogoInstitucion nombre={f.nombre} logoUrl={f.logoUrl} tamano={44} className="rounded-xl" />
                <span className="min-w-0 text-[14.5px] leading-snug font-semibold text-tinta">{f.nombre}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
