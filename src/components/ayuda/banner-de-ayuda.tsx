import Link from "next/link";
import { NodosMarca } from "@/components/app/nodos-marca";

/** El encabezado azul del centro de ayuda público (la misma identidad que Contacto y Quiénes somos), con migas de pan y, si hace falta, el buscador. */
export function BannerDeAyuda({
  titulo,
  bajada,
  migas = [],
  children,
}: {
  titulo: string;
  bajada: string;
  /** El camino hasta acá, sin la página actual: `[{ texto: "Centro de ayuda", href: "/ayuda" }]`. */
  migas?: { texto: string; href: string }[];
  children?: React.ReactNode;
}) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-marco bg-navy-900 px-12 py-11 text-white max-[560px]:px-6 max-[560px]:py-9">
      <NodosMarca className="absolute -top-10 -right-8 w-[260px] opacity-90 max-[700px]:w-[170px] max-[700px]:opacity-60" />
      {migas.length > 0 && (
        <nav aria-label="Dónde estás" className="relative mb-3 flex flex-wrap items-center gap-x-2 text-[13px] leading-none text-white/65">
          {migas.map((m) => (
            <span key={m.href} className="inline-flex items-center gap-2">
              <Link href={m.href} className="rounded text-white/75 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-celeste">
                {m.texto}
              </Link>
              <span aria-hidden>›</span>
            </span>
          ))}
        </nav>
      )}
      <h1 className="font-display relative m-0 mb-2.5 text-[38px] leading-[1.1] font-semibold tracking-[-0.025em] max-[560px]:text-[29px]">{titulo}</h1>
      <p className="relative m-0 mb-5 max-w-[56ch] text-[16px] leading-[1.6] text-white/75">{bajada}</p>
      {children && <div className="relative">{children}</div>}
    </section>
  );
}

/** «¿No encontraste lo que buscabas?»: lleva a Contacto. */
export function BandaDeContacto() {
  return (
    <section className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-marco bg-white px-8 py-7 shadow-tarjeta max-[560px]:px-5">
      <div>
        <h2 className="font-display m-0 mb-1 text-[20px] leading-tight font-semibold tracking-[-0.015em] text-navy-900">¿No encontraste lo que buscabas?</h2>
        <p className="m-0 text-[14.5px] leading-normal text-apagado">Escribinos y te respondemos en el día.</p>
      </div>
      <Link
        href="/contacto"
        className="inline-flex h-[46px] items-center rounded-xl bg-navy-700 px-6 text-[14.5px] font-semibold text-white transition-colors hover:bg-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
      >
        Ir a Contacto
      </Link>
    </section>
  );
}
