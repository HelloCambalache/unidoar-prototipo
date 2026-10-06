import type { EstadoCeldaDisponibilidad, GrillaDisponibilidad } from "@/db/schema";
import { DIAS, FRANJAS, resumenDisponibilidad } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const CELDA: Record<EstadoCeldaDisponibilidad, string> = {
  disponible: "bg-navy-700",
  convenir: "bg-[#8CA9BE]",
  ocupada: "bg-[#F0EFEA]",
};

/** Grilla de disponibilidad horaria (franja × día) del perfil de un docente, solo lectura. */
export function DisponibilidadDocente({ grilla }: { grilla: GrillaDisponibilidad }) {
  const filas = FRANJAS.map((f) => ({ ...f, celdas: grilla[f.clave] }));
  const resumen = resumenDisponibilidad(grilla);
  const columnas = "grid grid-cols-[70px_repeat(6,minmax(0,1fr))] gap-1.5";
  return (
    <div>
      {/* La grilla es visual: para lectores de pantalla va el resumen en palabras. */}
      <div aria-hidden>
        <div className={cn(columnas, "mb-2 text-xs leading-none text-apagado")}>
          <span />
          {DIAS.map((d) => (
            <span key={d} className="text-center">
              {d}
            </span>
          ))}
        </div>
        {filas.map((f) => (
          <div key={f.clave} className={cn(columnas, "mb-1.5")}>
            <span className="self-center text-[13px] leading-none text-apagado">{f.etiqueta}</span>
            {f.celdas.map((c, i) => (
              <span key={i} className={cn("h-7 rounded-md", CELDA[c])} />
            ))}
          </div>
        ))}
        <div className="mt-3.5 flex flex-wrap gap-4 text-xs leading-none text-apagado">
          {(
            [
              ["disponible", "Disponible"],
              ["convenir", "A convenir"],
              ["ocupada", "Ocupada"],
            ] as const
          ).map(([estado, etiqueta]) => (
            <span key={estado} className="flex items-center gap-1.5">
              <span className={cn("inline-block size-2.5 rounded-[3px]", CELDA[estado])} />
              {etiqueta}
            </span>
          ))}
        </div>
      </div>
      <ul className="sr-only">
        {resumen.map((r) => (
          <li key={r.titulo}>
            {r.titulo}: {r.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}
