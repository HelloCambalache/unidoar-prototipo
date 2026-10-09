"use client";

import { useState } from "react";
import { Icono } from "@/components/icons";
import { BotonLink } from "@/components/ui/button";
import {
  PACK_LANZAMIENTO,
  packDe,
  pesos,
  PLANES,
  PLANES_VIGENTES,
  SEDES_MULTISEDE,
  TIPOS_POR_PLAN,
  type PlanClave,
} from "@/lib/planes";
import { RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";

/** Cómo se llama cada arancel en el desplegable: la institución se reconoce en uno. */
const ETIQUETA: Record<string, string> = {
  colegio: "Colegio, jardín o terciario",
  deportiva: "Club, gimnasio o academia",
  multisede: `Red de más de ${SEDES_MULTISEDE} sedes`,
};

/** Los tipos que entran en cada arancel, para que quien elige sepa si es el suyo. */
function detalleDe(clave: PlanClave) {
  if (clave === "multisede") return PLANES.multisede.detalle;
  const tipos = TIPOS_POR_PLAN[clave as keyof typeof TIPOS_POR_PLAN];
  return tipos ? `Incluye ${tipos.join(", ").toLowerCase()}.` : PLANES[clave].detalle;
}

/**
 * Tarjeta de precio de las instituciones. El arancel depende del tipo, así que en vez de una tarjeta
 * por precio hay una sola con un desplegable: la institución se elige a sí misma y ve lo que paga.
 */
export function PlanesInstituciones({ beneficios }: { beneficios: readonly string[] }) {
  const [clave, setClave] = useState<PlanClave>("colegio");
  const plan = PLANES[clave];
  const pack = packDe(clave);

  return (
    <article className="relative flex min-w-[320px] flex-[1.15] flex-col overflow-hidden rounded-[14px] bg-navy-700 px-8 py-9 text-white max-[560px]:px-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[60px] -right-[50px] size-[200px] rounded-full bg-[radial-gradient(circle,rgba(245,147,50,.3),transparent_70%)]"
      />
      <h2 className="relative m-0 text-xs leading-none font-semibold tracking-[.08em] text-celeste uppercase">
        Instituciones
      </h2>

      <label className="relative mt-4 block">
        <span className="mb-1.5 block text-[13px] leading-none text-white/60">¿Qué tipo de institución sos?</span>
        <select
          value={clave}
          onChange={(e) => setClave(e.target.value as PlanClave)}
          className="w-full cursor-pointer appearance-none rounded-lg border border-white/25 bg-white/10 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222%22 stroke-linecap=%22round%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:18px] bg-[position:right_12px_center] bg-no-repeat py-2.5 pr-10 pl-3.5 text-[15px] leading-tight font-medium text-white focus:border-celeste focus:outline-none"
        >
          {PLANES_VIGENTES.map((c) => (
            <option key={c} value={c} className="bg-navy-700 text-white">
              {ETIQUETA[c] ?? PLANES[c].label}
            </option>
          ))}
        </select>
      </label>

      <div className="relative mt-5 mb-1">
        <span className="text-[38px] leading-none font-bold tracking-[-0.02em]">{pesos(plan.precio)}</span>
        <span className="text-[15px] leading-none text-white/60">
          &nbsp;/ mes{plan.porSede ? " por sede" : ""}
        </span>
      </div>
      <p className="relative mb-5 text-sm leading-normal text-white/65">{detalleDe(clave)}</p>

      <ul className="relative m-0 flex flex-1 list-none flex-col gap-3 p-0 text-sm leading-normal text-white/85">
        {beneficios.map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <Icono nombre="tilde" tamano={16} trazo={2} className="mt-0.5 shrink-0 text-celeste" />
            {b}
          </li>
        ))}
      </ul>

      <p className="relative mt-5 mb-0 rounded-lg bg-white/8 px-3.5 py-2.5 text-[13px] leading-[1.5] text-white/70">
        Pack de {PACK_LANZAMIENTO.meses} meses por adelantado:{" "}
        <b className="font-semibold text-white">{pesos(pack.anticipado)}</b> en lugar de {pesos(pack.lista)}
        {plan.porSede ? ", por sede" : ""}.
      </p>

      <BotonLink
        href={RUTA_REGISTRO_INSTITUCION}
        variante="cta"
        tamano="lg"
        bloque
        className="relative mt-[22px] h-[50px] bg-ambar text-tinta shadow-[0_4px_10px_rgba(245,147,50,.35)] hover:bg-ambar hover:text-tinta hover:brightness-95"
      >
        Crear cuenta de institución
      </BotonLink>
    </article>
  );
}
