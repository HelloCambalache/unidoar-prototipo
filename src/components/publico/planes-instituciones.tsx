"use client";

import { useState } from "react";
import { Icono } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { enlaceDeWhatsApp } from "@/lib/compartir-perfil";
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
import { cn } from "@/lib/utils";

/** Cómo se llama cada arancel en los botones: corto, para que entren en una línea. */
const ETIQUETA: Record<string, string> = {
  colegio: "Colegios",
  deportiva: "Clubes y gimnasios",
  multisede: `Más de ${SEDES_MULTISEDE} sedes`,
};

/** Lo que se manda al recomendar: lo escribe la institución que ya está, a un colega. */
const TEXTO_REFERIDO = "Te paso UNIDOAR, lo usamos para cubrir búsquedas de profesionales:";

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
export function PlanesInstituciones({ beneficios, url }: { beneficios: readonly string[]; url: string }) {
  const [clave, setClave] = useState<PlanClave>("colegio");
  const toast = useToast();
  const plan = PLANES[clave];
  const pack = packDe(clave);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Enlace copiado");
    } catch {
      toast("No pudimos copiarlo solo: copiá la dirección de esta página.", "error");
    }
  };

  return (
    <article className="relative flex min-w-[320px] flex-[1.15] flex-col overflow-hidden rounded-[14px] bg-navy-700 px-8 py-9 text-white max-[560px]:px-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[60px] -right-[50px] size-[200px] rounded-full bg-[radial-gradient(circle,rgba(245,147,50,.3),transparent_70%)]"
      />
      <h2 className="relative m-0 text-xs leading-none font-semibold tracking-[.08em] text-celeste uppercase">
        Instituciones
      </h2>

      <div className="relative mt-4">
        <span id="tipo-institucion" className="mb-2 block text-[13px] leading-none text-white/60">
          ¿Qué tipo de institución sos?
        </span>
        <div role="group" aria-labelledby="tipo-institucion" className="flex flex-wrap gap-2">
          {PLANES_VIGENTES.map((c) => {
            const elegido = c === clave;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setClave(c)}
                aria-pressed={elegido}
                className={cn(
                  "cursor-pointer rounded-full px-3.5 py-2 text-[13.5px] leading-none font-semibold transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-celeste",
                  elegido ? "bg-white text-navy-700" : "border border-white/25 text-white/75 hover:bg-white/10",
                )}
              >
                {ETIQUETA[c] ?? PLANES[c].label}
              </button>
            );
          })}
        </div>
      </div>

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

      <div className="relative mt-5 rounded-lg bg-white/8 px-4 py-3.5">
        <span className="inline-block rounded-full bg-verde-tint px-2.5 py-[5px] text-xs leading-none font-semibold text-verde">
          1 mes bonificado
        </span>
        <div className="mt-2.5 text-sm leading-tight font-semibold text-white">Pago por adelantado</div>
        <p className="m-0 mt-1 text-[13px] leading-[1.5] text-white/70">
          Contratás el pack de {PACK_LANZAMIENTO.meses} meses y pagás {PACK_LANZAMIENTO.mesesQueSePagan}:{" "}
          <b className="font-semibold text-white">{pesos(pack.anticipado)}</b> en lugar de {pesos(pack.lista)}
          {plan.porSede ? ", por sede" : ""}.
        </p>
      </div>

      <div className="relative mt-3 rounded-lg bg-white/8 px-4 py-3.5">
        <span className="inline-block rounded-full bg-verde-tint px-2.5 py-[5px] text-xs leading-none font-semibold text-verde">
          1 mes más
        </span>
        <div className="mt-2.5 text-sm leading-tight font-semibold text-white">Plan Referidos</div>
        <p className="m-0 mt-1 text-[13px] leading-[1.5] text-white/70">
          Recomendás a otra institución y se suma a la red: pagás {PACK_LANZAMIENTO.mesesConReferido} de los{" "}
          {PACK_LANZAMIENTO.meses}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={enlaceDeWhatsApp(`${TEXTO_REFERIDO} ${url}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-1.5 text-xs leading-none font-semibold text-white/85 transition-colors hover:bg-white/10"
          >
            Recomendar por WhatsApp
          </a>
          <button
            type="button"
            onClick={copiar}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/25 px-3 py-1.5 text-xs leading-none font-semibold text-white/85 transition-colors hover:bg-white/10"
          >
            Copiar enlace
          </button>
        </div>
      </div>

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
