import { BotonLink } from "@/components/ui/button";
import { RUTA_REGISTRO_DOCENTE } from "@/lib/publico";

/** Aviso azul de los listados públicos: se mira sin cuenta, pero para actuar hay que crearla. */
export function MuroCuenta({ titulo, bajada }: { titulo: string; bajada: string }) {
  return (
    <div className="mb-[26px] flex flex-wrap items-center justify-between gap-[18px] rounded-xl bg-navy-700 px-[26px] py-[22px] max-[560px]:px-5">
      <div className="min-w-0 flex-[1_1_320px]">
        <div className="mb-[5px] font-display text-[19px] leading-[1.3] font-bold text-white">{titulo}</div>
        <p className="text-sm leading-normal text-white/72">{bajada}</p>
      </div>
      <div className="flex flex-none flex-wrap gap-2.5 max-[560px]:w-full max-[560px]:[&>a]:flex-1">
        <BotonLink
          href="/ingresar"
          variante="secundario"
          className="border-white/35 bg-transparent text-white hover:border-white/60 hover:bg-white/10 hover:text-white"
        >
          Ya tengo cuenta
        </BotonLink>
        <BotonLink href={RUTA_REGISTRO_DOCENTE} variante="cta">
          Crear cuenta gratis
        </BotonLink>
      </div>
    </div>
  );
}
