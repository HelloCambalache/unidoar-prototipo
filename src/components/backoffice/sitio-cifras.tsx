"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cambiarCifrasDelSitio } from "@/app/actions/backoffice-configuracion";
import { Boton } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";

export type CifraDeLaRed = { valor: string; etiqueta: string };

/**
 * «Cifras de la red» (Backoffice → Sitio): el interruptor que muestra u oculta, en el sitio público, los números de la red (profesionales e
 * instituciones verificados, búsquedas activas, disciplinas). `cifras` son los números de HOY (los de verdad, aunque estén ocultos) para que
 * el equipo vea qué se mostraría; `ultimoCambio` es la fecha ya escrita (o null si nunca se tocó).
 */
export function SitioCifras({ visibles, cifras, ultimoCambio }: { visibles: boolean; cifras: CifraDeLaRed[]; ultimoCambio: string | null }) {
  const toast = useToast();
  const router = useRouter();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();

  const cambiar = async () => {
    const mostrar = !visibles;
    const ok = await pedirConfirmacion(
      mostrar
        ? "¿Mostrar las cifras de la red? Se van a ver en el sitio público, desde ahora: la franja de la portada, los números de cada categoría y las páginas de docentes, entrenadores y guardavidas."
        : "¿Ocultar las cifras de la red? Dejan de verse en el sitio público, desde ahora. Se pueden volver a mostrar cuando quieras.",
    );
    if (!ok) return;
    empezar(async () => {
      const r = await cambiarCifrasDelSitio(mostrar);
      if (!r.ok) {
        toast(r.error, "error");
        return;
      }
      toast(mostrar ? "Las cifras de la red se muestran en el sitio" : "Las cifras de la red quedaron ocultas");
      router.refresh();
    });
  };

  return (
    <Tarjeta className="p-[22px]">
      <EtiquetaSeccion className="mb-3">Cifras de la red</EtiquetaSeccion>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Insignia tono={visibles ? "verde" : "naranja"} punto>
          {visibles ? "Se muestran en el sitio" : "Ocultas en el sitio"}
        </Insignia>
        {ultimoCambio && <span className="text-xs leading-none text-sutil">Último cambio: {ultimoCambio}</span>}
      </div>
      <p className="m-0 mb-3.5 max-w-[62ch] text-[13.5px] leading-[1.55] text-apagado">
        Son los números de la portada («profesionales verificados», «instituciones verificadas», «búsquedas activas» y «disciplinas»), los de cada
        categoría (en el mosaico de arriba, en las tarjetas de «Buscás empleo» y en /categorias), el contador de tipos de institución y los del
        costado de las páginas de docentes, entrenadores y guardavidas. Ocultos, esos lugares desaparecen y el resto del sitio queda igual.{" "}
        <b className="font-semibold text-tinta">Las búsquedas urgentes abiertas no se tocan.</b>
      </p>

      <div className="mb-4 rounded-caja bg-[#F7F6F2] px-4 py-3.5">
        <div className="mb-2 text-xs leading-none font-semibold tracking-[.04em] text-sutil uppercase">Hoy serían</div>
        <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1.5 p-0 text-[13.5px] leading-snug text-tinta-2">
          {cifras.map((c) => (
            <li key={c.etiqueta}>
              <b className="font-semibold text-tinta">{c.valor}</b> {c.etiqueta}
            </li>
          ))}
        </ul>
      </div>

      <Boton variante={visibles ? "secundario" : "primario"} onClick={cambiar} disabled={pendiente} aria-busy={pendiente}>
        {pendiente ? "Guardando…" : visibles ? "Ocultar las cifras" : "Mostrar las cifras"}
      </Boton>
    </Tarjeta>
  );
}
