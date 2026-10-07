import type { Docente } from "@/db/schema";
import { BotonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Aviso para el docente cuando el equipo le pidió una corrección o rechazó su verificación, con el motivo que
 * escribió quien revisó (`docentes.verificacion_nota`). No muestra nada en los demás estados.
 *
 * El docente corrige desde su perfil (DNI, título, certificado de buena conducta y CV): al subir documentación nueva
 * vuelve a la cola de revisión del equipo. Si la verificación se rechazó, el equipo lo atiende desde Contacto.
 */
export function AvisoVerificacion({
  verificacion,
  nota,
  enlacePerfil = false,
  className,
}: {
  verificacion: Docente["verificacion"];
  nota: string | null;
  /** En el dashboard suma el enlace a "Mi perfil"; en el perfil ya estás ahí. */
  enlacePerfil?: boolean;
  className?: string;
}) {
  if (verificacion !== "correccion" && verificacion !== "rechazado") return null;
  const rechazado = verificacion === "rechazado";

  return (
    <section
      aria-labelledby="aviso-verificacion"
      className={cn(
        "mb-5 rounded-ud border px-5 py-4",
        rechazado ? "border-rosa/25 bg-rosa-tint text-rosa" : "border-[#F6DDB6] bg-[#FEF1DF] text-[#8A4B07]",
        className,
      )}
    >
      <h2 id="aviso-verificacion" className="m-0 mb-1 text-[15px] leading-snug font-semibold">
        {rechazado ? "No pudimos verificar tu perfil" : "Necesitamos que corrijas tu documentación"}
      </h2>
      <p className="m-0 text-[13.5px] leading-normal">
        {nota ? (
          <>
            <b className="font-semibold">Motivo:</b> {nota}
          </>
        ) : rechazado ? (
          "El equipo de UNIDOAR no pudo verificar tu identidad."
        ) : (
          "El equipo de UNIDOAR te pidió un cambio en lo que subiste."
        )}
      </p>
      <p className="m-0 mt-1.5 text-[13px] leading-normal opacity-90">
        {rechazado
          ? "Si creés que es un error, escribinos y lo revisamos."
          : "Subí de nuevo lo que haga falta desde tu perfil (el DNI, el título, el certificado o el CV): cuando lo guardes, vuelve a revisión. Si algo no queda claro, escribinos."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {enlacePerfil && !rechazado && (
          <BotonLink href="/docente/perfil#documentacion" tamano="sm" variante="secundario">
            Ir a mi perfil
          </BotonLink>
        )}
        <BotonLink href="/contacto" tamano="sm" variante="secundario">
          Escribir al equipo
        </BotonLink>
      </div>
    </section>
  );
}
