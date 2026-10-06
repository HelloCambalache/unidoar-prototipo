import { Insignia } from "@/components/ui/insignia";
import { VERIFICACION_BO, type EstadoVerificacionDocente } from "@/lib/backoffice-docentes";

/** Estado de verificación de un docente: Verificado / En cola / Corrección pedida / Rechazado. */
export function DocInsigniaVerificacion({ estado, className }: { estado: EstadoVerificacionDocente; className?: string }) {
  const v = VERIFICACION_BO[estado];
  return (
    <Insignia tono={v.tono} className={className}>
      {v.etiqueta}
    </Insignia>
  );
}

/** Cuenta con el acceso bloqueado por el equipo. */
export function DocInsigniaSuspendida({ className }: { className?: string }) {
  return (
    <Insignia tono="rosa" punto className={className}>
      Suspendida
    </Insignia>
  );
}
