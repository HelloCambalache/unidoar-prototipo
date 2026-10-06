"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { contarCoincidencias } from "@/app/actions/busquedas";
import {
  componerHorario,
  TOPE_AVISOS,
  type CriteriosCoincidencia,
  type ResumenCoincidencias,
} from "@/lib/busquedas";
import { cn } from "@/lib/utils";

export type Interruptores = { ampliarZona: boolean; incluirSinVerificar: boolean; turnoExtra: boolean };

function Delta({ valor }: { valor: number }) {
  const texto = valor > 0 ? `+${valor}` : valor < 0 ? `−${Math.abs(valor)}` : "0";
  return (
    <span className={cn("font-semibold", valor > 0 ? "text-verde" : valor < 0 ? "text-naranja-oscuro" : "text-sutil")}>
      {texto}
    </span>
  );
}

/**
 * Columna lateral de "Publicar": cuántos docentes de la base coinciden con lo que se va
 * completando, y cuánto cambia el número con cada interruptor. Los interruptores son campos
 * del formulario: al publicar definen a quiénes se les avisa.
 */
export function PanelCoincidencias({
  criterios,
  interruptores,
  onInterruptor,
  modo,
}: {
  criterios: CriteriosCoincidencia;
  interruptores: Interruptores;
  onInterruptor: (clave: keyof Interruptores, valor: boolean) => void;
  modo: "crear" | "editar";
}) {
  const [resumen, setResumen] = useState<ResumenCoincidencias | null>(null);
  const [fallo, setFallo] = useState(false);
  const [pendiente, empezar] = useTransition();
  const ultima = useRef(0);

  const clave = JSON.stringify({ ...criterios, ...interruptores });

  // Con debounce: mientras se escribe no se consulta; solo vale la última respuesta.
  useEffect(() => {
    const solicitud = ++ultima.current;
    const espera = setTimeout(() => {
      empezar(async () => {
        let r: Awaited<ReturnType<typeof contarCoincidencias>> | null = null;
        try {
          r = await contarCoincidencias(JSON.parse(clave));
        } catch {
          // Un corte de red no tiene que tirar abajo el formulario: el panel avisa y reintenta al próximo cambio.
        }
        if (solicitud !== ultima.current) return;
        if (r?.ok) {
          setResumen(r.data);
          setFallo(false);
        } else {
          setFallo(true);
        }
      });
    }, 400);
    return () => clearTimeout(espera);
  }, [clave, empezar]);

  const turno = criterios.turno;
  const etiquetaTurno = turno ? (componerHorario(turno, null) ?? turno).toLowerCase() : null;
  const total = resumen?.total ?? 0;

  return (
    <div className="flex w-[280px] flex-none flex-col gap-4 max-[1000px]:w-full">
      <div
        className={cn("rounded-ud bg-navy-700 p-5 text-white transition-opacity", pendiente && "opacity-70")}
        aria-busy={pendiente}
      >
        <div className="mb-3.5 flex items-center gap-1.5 text-[11px] leading-none font-semibold tracking-[.06em] text-navy-100 uppercase">
          <span className="size-1.5 rounded-full bg-celeste" />
          Se actualiza mientras completás
        </div>
        <div aria-live="polite">
          <div className="mb-1.5 text-[32px] leading-none font-semibold">{resumen ? total : "—"}</div>
          <div className="mb-3.5 text-sm leading-[1.4]">
            {fallo
              ? "No pudimos calcular las coincidencias. Seguí completando: se vuelve a intentar al cambiar algo."
              : !resumen
                ? "Calculando cuántos docentes coinciden…"
                : `${total === 1 ? "docente coincide" : "docentes coinciden"} con estos criterios en tu zona`}
          </div>
        </div>

        {resumen && total > 0 && (
          <div className="mb-4 flex" aria-hidden>
            {resumen.iniciales.map((ini, i) => (
              <span
                key={i}
                className="-mr-2 inline-flex size-[30px] items-center justify-center rounded-full border-2 border-navy-700 bg-navy-300 text-[10px] leading-none font-semibold text-white"
              >
                {ini}
              </span>
            ))}
            {total > resumen.iniciales.length && (
              <span className="inline-flex size-[30px] items-center justify-center rounded-full border-2 border-navy-700 bg-white/20 text-[10px] leading-none font-semibold text-white">
                +{total - resumen.iniciales.length}
              </span>
            )}
          </div>
        )}

        {resumen && (
          <dl className="m-0 flex flex-col gap-2 border-t border-white/[.18] pt-3.5 text-[13px] leading-none text-white/85">
            <div className="flex justify-between gap-3">
              <dt>Verificados</dt>
              <dd className="m-0 font-semibold text-white">
                {interruptores.incluirSinVerificar ? `${resumen.verificados} de ${total}` : resumen.verificados}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Con título verificado</dt>
              <dd className="m-0 font-semibold text-white">{resumen.conTitulo}</dd>
            </div>
            {resumen.disponiblesTurno !== null && etiquetaTurno && (
              <div className="flex justify-between gap-3">
                <dt>Disponibles {etiquetaTurno}</dt>
                <dd className="m-0 font-semibold text-white">{resumen.disponiblesTurno}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {resumen && (
        <div className="rounded-ud border border-borde bg-white p-[18px]">
          <div className="mb-3 text-sm leading-none font-semibold">Cómo cambia el número</div>
          <div className="flex flex-col gap-[9px] text-[13px] leading-tight">
            {resumen.escenarios.zona !== null && (
              <Escenario
                nombre="ampliarZona"
                activo={interruptores.ampliarZona}
                onCambio={(v) => onInterruptor("ampliarZona", v)}
                texto="Si ampliás a partidos linderos"
                delta={resumen.escenarios.zona}
              />
            )}
            <Escenario
              nombre="incluirSinVerificar"
              activo={interruptores.incluirSinVerificar}
              onCambio={(v) => onInterruptor("incluirSinVerificar", v)}
              texto="Si aceptás perfiles sin verificar"
              delta={resumen.escenarios.sinVerificar}
            />
            {resumen.escenarios.turnoExtra && (
              <Escenario
                nombre="turnoExtra"
                activo={interruptores.turnoExtra}
                onCambio={(v) => onInterruptor("turnoExtra", v)}
                texto={`Si pedís también turno ${resumen.escenarios.turnoExtra.turno}`}
                delta={resumen.escenarios.turnoExtra.delta}
              />
            )}
          </div>
          {!resumen.zonaResuelta && (
            <p className="mt-3 mb-0 text-xs leading-normal text-sutil">
              No pudimos ubicar esa zona en nuestro catálogo, así que contamos docentes de todas las zonas.
            </p>
          )}
        </div>
      )}

      <p className="m-0 text-xs leading-normal text-sutil">
        {modo === "editar"
          ? "Al guardar los cambios no se vuelve a avisar a los docentes."
          : resumen && resumen.conCuenta > 0
            ? `Al publicar, les avisamos a ${resumen.conCuenta === 1 ? "la persona que tiene" : `los ${Math.min(resumen.conCuenta, TOPE_AVISOS)} que tienen`} cuenta en UNIDOAR${resumen.conCuenta > TOPE_AVISOS ? ` (el aviso llega a los primeros ${TOPE_AVISOS})` : ""}. El resto la ve cuando busca trabajo.`
            : "Al publicar, la búsqueda queda visible para los docentes que busquen trabajo en tu zona."}
      </p>
    </div>
  );
}

function Escenario({
  nombre,
  activo,
  onCambio,
  texto,
  delta,
}: {
  nombre: string;
  activo: boolean;
  onCambio: (valor: boolean) => void;
  texto: string;
  delta: number;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-tinta-2">
        <input
          type="checkbox"
          name={nombre}
          checked={activo}
          onChange={(e) => onCambio(e.target.checked)}
          className="size-4 flex-none accent-navy-700"
        />
        {texto}
      </span>
      <Delta valor={delta} />
    </label>
  );
}
