"use client";

import { Casilla, Select } from "@/components/ui/campos";
import { armarHorario, HORAS, nombreDia, ORDEN_DIAS, type DiaCurso, type DiasCurso } from "@/lib/cursos";
import { cn } from "@/lib/utils";

/**
 * Los días del curso salen solos del rango de fechas; cada uno se puede apagar y lleva su franja horaria.
 * El estado vive en el formulario (que guarda el texto resultante en `cursos.horario`).
 */
export function CursoHorario({
  dias,
  onCambio,
  horarioGuardado,
  resumen,
}: {
  dias: DiasCurso;
  onCambio: (dias: DiasCurso) => void;
  /** Texto que ya tenía el curso: se muestra mientras no haya fechas con las que armar la grilla. */
  horarioGuardado?: string;
  /** Lo que se va a guardar como horario (por defecto, el que arma la grilla). */
  resumen?: string;
}) {
  const filas = ORDEN_DIAS.filter((n) => dias[n]);

  const cambiar = (n: number, parte: Partial<DiaCurso>) => onCambio({ ...dias, [n]: { ...dias[n]!, ...parte } });

  if (filas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-borde-fuerte px-4 py-3.5 text-[13px] leading-normal text-apagado">
        Elegí la fecha de inicio y la de finalización: los días del curso se cargan solos y después ponés el horario de cada uno.
        {horarioGuardado && (
          <div className="mt-2 text-tinta-2">
            Horario actual: <b className="font-semibold">{horarioGuardado}</b>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-borde bg-white">
        {filas.map((n) => {
          const d = dias[n]!;
          const nombre = nombreDia(n);
          return (
            <div
              key={n}
              className="flex flex-wrap items-center gap-2.5 border-b border-borde px-3.5 py-[9px] last:border-b-0"
            >
              <Casilla
                checked={d.activo}
                onChange={(e) => cambiar(n, { activo: e.target.checked })}
                className="min-w-0 flex-[1_1_140px] items-center text-sm font-medium text-tinta"
              >
                {nombre}
              </Casilla>
              <div className={cn("flex items-center gap-2", !d.activo && "pointer-events-none opacity-40")}>
                <SelectorHora
                  etiqueta={`Hora de inicio, ${nombre.toLowerCase()}`}
                  valor={d.desde}
                  deshabilitado={!d.activo}
                  onCambio={(desde) => cambiar(n, { desde })}
                />
                <span className="flex-none text-[13px] leading-none text-apagado">a</span>
                <SelectorHora
                  etiqueta={`Hora de fin, ${nombre.toLowerCase()}`}
                  valor={d.hasta}
                  deshabilitado={!d.activo}
                  onCambio={(hasta) => cambiar(n, { hasta })}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="m-0 mt-2 text-[12.5px] leading-normal text-apagado">
        Queda como: <b className="font-semibold text-tinta-2">{resumen || armarHorario(dias)}</b>
      </p>
    </div>
  );
}

function SelectorHora({
  etiqueta,
  valor,
  deshabilitado,
  onCambio,
}: {
  etiqueta: string;
  valor: string;
  deshabilitado: boolean;
  onCambio: (valor: string) => void;
}) {
  // Una hora que no está en la lista (cargada a mano) se conserva como opción.
  const horas = HORAS.includes(valor) ? HORAS : [valor, ...HORAS];
  return (
    <div className="w-[118px] min-w-0">
      <Select aria-label={etiqueta} value={valor} disabled={deshabilitado} onChange={(e) => onCambio(e.target.value)}>
        {horas.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </Select>
    </div>
  );
}
