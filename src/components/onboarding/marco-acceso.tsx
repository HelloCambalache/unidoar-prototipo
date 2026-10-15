import Image from "next/image";
import Link from "next/link";
import { NodosMarca } from "@/components/app/nodos-marca";
import { focoDeFoto } from "@/lib/fotos";

const FOTO_ACCESO = "/assets/aula-secundaria.jpg";

/**
 * Pantalla partida de /registro, /ingresar y sus variantes: foto con overlay azul y el isotipo a la izquierda,
 * formulario en una tarjeta blanca a la derecha, los dos redondeados sobre el fondo cálido. En ≤ 860 px la foto pasa arriba.
 */
export function MarcoAcceso({
  titulo = "Profesionales verificados y sin vueltas.",
  bajada = "Identidad y títulos confirmados antes de que los veas.",
  volverHref = "/",
  volverTexto = "‹ Volver al inicio",
  children,
}: {
  titulo?: string;
  bajada?: string;
  volverHref?: string;
  volverTexto?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen gap-4 bg-lienzo p-4 max-[860px]:flex-col max-[860px]:gap-0 max-[860px]:p-0">
      <div className="relative flex min-w-0 flex-1 flex-col justify-between overflow-hidden rounded-[32px] max-[860px]:h-[240px] max-[860px]:flex-none max-[860px]:rounded-none">
        <Image
          src={FOTO_ACCESO}
          alt=""
          fill
          priority
          sizes="(max-width: 860px) 100vw, 50vw"
          style={{ objectPosition: focoDeFoto(FOTO_ACCESO) }}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,11,53,.25),rgba(4,11,53,.88))]" />
        <NodosMarca className="absolute -top-10 -right-12 w-[280px] opacity-80 max-[860px]:hidden" />
        <Link href="/" className="relative z-[1] m-10 flex items-center gap-2.5 self-start max-[860px]:m-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- isotipo fijo */}
          <img src="/assets/unidoar-logo.png" alt="" className="size-10 object-contain" />
          <span className="font-display text-[18px] font-semibold tracking-[0.08em] text-white">UNIDOAR</span>
        </Link>
        <div className="relative z-[1] p-12 text-white max-[860px]:px-6 max-[860px]:pt-0 max-[860px]:pb-7">
          <div className="font-display mb-3 max-w-[18ch] text-[40px] leading-[1.08] font-semibold tracking-[-0.025em] max-[860px]:text-[26px]">
            {titulo}
          </div>
          <div className="max-w-[38ch] text-[16px] leading-normal text-white/80 max-[860px]:text-[14px]">{bajada}</div>
        </div>
      </div>

      <main className="relative flex min-w-[360px] max-w-[540px] flex-1 flex-col justify-center rounded-[32px] bg-white px-14 py-12 shadow-tarjeta max-[860px]:max-w-none max-[860px]:min-w-0 max-[860px]:rounded-none max-[860px]:px-6 max-[860px]:py-9 max-[860px]:shadow-none">
        <div className="relative z-[1] mx-auto flex w-full max-w-[400px] flex-col">
          <Link
            href={volverHref}
            className="mb-7 inline-flex min-h-10 items-center self-start rounded-full bg-lienzo px-4 text-[13px] leading-none font-semibold text-tinta-2 hover:bg-linea hover:text-tinta"
          >
            {volverTexto}
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
