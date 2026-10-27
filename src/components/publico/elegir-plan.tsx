"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { crearPlanes, type CatalogoDePlanes, type PlanClave } from "@/lib/planes";
import { cn } from "@/lib/utils";

/*
 * Lo que la persona va eligiendo en la página de planes: el tipo de institución (en la tarjeta de instituciones) y si paga el abono mes a mes o el
 * semestre de una vez (en un interruptor ARRIBA de las dos tarjetas). Viven en un contexto para que el interruptor, que está fuera de la tarjeta,
 * y la tarjeta se enteren uno del otro.
 */

type Elegido = {
  clave: PlanClave;
  elegirClave: (c: PlanClave) => void;
  semestral: boolean;
  elegirSemestral: (v: boolean) => void;
};

const Contexto = createContext<Elegido | null>(null);

export function ProveedorDePlanes({ children }: { children: ReactNode }) {
  const [clave, elegirClave] = useState<PlanClave>("colegio");
  const [semestral, elegirSemestral] = useState(false);
  return <Contexto value={{ clave, elegirClave, semestral, elegirSemestral }}>{children}</Contexto>;
}

export function usePlanElegido() {
  const elegido = useContext(Contexto);
  if (!elegido) throw new Error("usePlanElegido va dentro de ProveedorDePlanes");
  return elegido;
}

/** "1 mes" · "2 meses" */
const meses = (n: number) => `${n} ${n === 1 ? "mes" : "meses"}`;

/**
 * «Mensual / Semestral», centrado arriba de las tarjetas. Solo cambia lo que se ve en la tarjeta de instituciones y solo con los aranceles con abono:
 * con una sola búsqueda o con una red de sedes (un convenio) no hay semestre, y el interruptor queda apagado con el motivo.
 */
export function InterruptorDePago({ catalogo }: { catalogo: CatalogoDePlanes }) {
  const P = crearPlanes(catalogo);
  const { clave, semestral, elegirSemestral } = usePlanElegido();
  const aplica = !P.esPuntual(clave) && !P.planDe(clave).porSede;
  const { meses: mesesDelPack, mesesQueSePagan } = P.condiciones.pack;

  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      <span id="forma-de-pago" className="text-[13px] leading-none font-semibold text-apagado">
        ¿Cómo querés pagar el abono?
      </span>
      <div
        role="group"
        aria-labelledby="forma-de-pago"
        className={cn("inline-flex rounded-full border border-borde bg-white p-1 shadow-tarjeta transition-opacity", !aplica && "opacity-50")}
      >
        {[
          { valor: false, etiqueta: "Mensual" },
          { valor: true, etiqueta: "Semestral" },
        ].map((o) => {
          const elegido = aplica && semestral === o.valor;
          return (
            <button
              key={o.etiqueta}
              type="button"
              disabled={!aplica}
              onClick={() => elegirSemestral(o.valor)}
              aria-pressed={elegido}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm leading-none font-semibold whitespace-nowrap transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700",
                aplica ? "cursor-pointer" : "cursor-not-allowed",
                elegido ? "bg-navy-700 text-white" : "text-tinta-2",
                aplica && !elegido && "hover:bg-navy-50",
              )}
            >
              {o.etiqueta}
              {o.valor && (
                <span className="rounded-full bg-verde-tint px-2 py-[3px] text-[11px] leading-none font-semibold text-verde">
                  {meses(mesesDelPack - mesesQueSePagan)} gratis
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="m-0 max-w-[60ch] text-[13px] leading-normal text-apagado" aria-live="polite">
        {!aplica
          ? "El semestre es para los planes con abono: elegilo con Colegios o Clubes."
          : semestral
            ? `Pagás ${mesesQueSePagan} meses de una vez y usás ${mesesDelPack}.`
            : `Mes a mes, o pagá el semestre y te bonificamos ${meses(mesesDelPack - mesesQueSePagan)}.`}
      </p>
    </div>
  );
}
