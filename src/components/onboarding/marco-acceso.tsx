import Image from "next/image";
import Link from "next/link";
import { focoDeFoto } from "@/lib/fotos";

const FOTO_ACCESO = "/assets/aula-secundaria.jpg";

/**
 * Pantalla partida de /registro, /ingresar y sus variantes: foto con overlay azul a la izquierda,
 * panel claro con grilla suave a la derecha. En ≤ 860 px la foto pasa arriba (230 px).
 */
export function MarcoAcceso({
  titulo = "Profesionales verificados, sin vueltas",
  bajada = "Identidad y título confirmados antes de que los veas.",
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
    <div className="flex min-h-screen max-[860px]:flex-col">
      <div className="relative flex min-w-0 flex-1 flex-col justify-end max-[860px]:h-[230px] max-[860px]:flex-none">
        <Image
          src={FOTO_ACCESO}
          alt=""
          fill
          priority
          sizes="(max-width: 860px) 100vw, 50vw"
          style={{ objectPosition: focoDeFoto(FOTO_ACCESO) }}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,33,79,.15),rgba(22,33,79,.8))] max-[860px]:bg-[linear-gradient(180deg,rgba(22,33,79,.5),rgba(22,33,79,.88))]" />
        <div className="relative z-[1] p-12 text-white max-[860px]:px-6 max-[860px]:py-8">
          <div className="mb-2.5 text-[26px] leading-[1.3] font-semibold">{titulo}</div>
          <div className="max-w-[34ch] text-[15px] leading-normal text-white/80">{bajada}</div>
        </div>
      </div>

      <main className="relative flex min-w-[340px] max-w-[480px] flex-1 flex-col justify-center overflow-hidden bg-[#FAFAF8] p-14 max-[860px]:max-w-none max-[860px]:min-w-0 max-[860px]:px-6 max-[860px]:py-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(#E3E1DC 1px,transparent 1px),linear-gradient(90deg,#E3E1DC 1px,transparent 1px)",
            backgroundSize: "46px 46px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%,#000 40%,transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%,#000 40%,transparent 100%)",
          }}
        />
        <div className="relative z-[1] flex flex-col">
          <Link href={volverHref} className="mb-[22px] text-[13px] leading-none font-medium text-sutil hover:text-tinta">
            {volverTexto}
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
