"use client";

import { useState, useTransition } from "react";
import { compartirPerfil } from "@/app/actions/docente";
import { botonClases } from "@/components/ui/button";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import { enlaceDeWhatsApp, rutaDePerfilCompartido, textoParaCompartir, urlDePerfilCompartido } from "@/lib/compartir-perfil";
import { cn } from "@/lib/utils";

/**
 * "Compartir mi perfil" en Mi perfil del profesional. Viene apagado: con el interruptor prendido el perfil tiene una página
 * pública (sin teléfono, email ni documentos) y acá se copia el enlace o se manda por WhatsApp. Apagarlo hace que el enlace
 * deje de funcionar. Es independiente del formulario de Mi perfil (no se guarda con "Guardar").
 */
export function PerfilCompartir({ tokenInicial, origen }: { tokenInicial: string | null; origen: string }) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [token, setToken] = useState(tokenInicial);
  const activo = token !== null;

  const url = token ? urlDePerfilCompartido(origen, token) : "";

  const cambiar = () => {
    empezar(async () => {
      try {
        const r = await compartirPerfil(!activo);
        if (r.ok) {
          setToken(r.data.token);
          toast(r.data.token ? "Listo: tu perfil ya tiene enlace para compartir." : "Apagamos el enlace: ya no se puede abrir tu perfil.");
        } else {
          toast(r.error, "error");
        }
      } catch {
        toast("No pudimos cambiar el enlace. Probá de nuevo.", "error");
      }
    });
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Enlace copiado");
    } catch {
      // Sin permiso para el portapapeles: se deja el texto seleccionado para copiarlo a mano.
      document.getElementById("perfil-enlace")?.focus();
      toast("No pudimos copiarlo solo: seleccioná el enlace y copialo.", "error");
    }
  };

  return (
    <Tarjeta como="section" className="p-4">
      <h2 className="m-0 mb-1.5 text-[15px] leading-none font-semibold">Compartir mi perfil</h2>
      <p className="m-0 mb-3.5 text-[13px] leading-normal text-apagado">
        Armá un enlace para mostrar tu perfil por WhatsApp, redes o mail. Se ven tu foto, formación y experiencia; nunca tu teléfono, tu email ni tus documentos.
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-busy={pendiente}
        disabled={pendiente}
        onClick={cambiar}
        className="flex w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none disabled:opacity-60"
      >
        <span className="text-sm leading-[1.3] font-semibold text-tinta">Enlace para compartir</span>
        <span className="flex flex-none items-center gap-2">
          <span className="text-xs leading-none text-apagado">{activo ? "Activado" : "Apagado"}</span>
          <span aria-hidden className={cn("relative h-[22px] w-[38px] flex-none rounded-full transition-colors duration-[180ms]", activo ? "bg-verde" : "bg-[#CFCCC5]")}>
            <span className={cn("absolute top-0.5 size-[18px] rounded-full bg-white transition-[left,right] duration-[180ms]", activo ? "right-0.5" : "left-0.5")} />
          </span>
        </span>
      </button>

      {token ? (
        <div className="mt-3.5 flex flex-col gap-2.5 border-t border-[#F0EFEA] pt-3.5">
          <input
            id="perfil-enlace"
            type="text"
            readOnly
            value={url}
            aria-label="Enlace de tu perfil"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-xl border border-borde bg-superficie px-3 py-2.5 text-[13px] text-tinta-2 focus:border-navy-700 focus:ring-[3px] focus:ring-navy-700/20 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiar} className={botonClases({ variante: "secundario", tamano: "sm" })}>
              Copiar enlace
            </button>
            <a
              href={enlaceDeWhatsApp(textoParaCompartir(url))}
              target="_blank"
              rel="noopener noreferrer"
              className={botonClases({ variante: "secundario", tamano: "sm" })}
            >
              WhatsApp
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
            <a href={rutaDePerfilCompartido(token)} target="_blank" rel="noopener noreferrer" className={botonClases({ variante: "secundario", tamano: "sm" })}>
              Ver cómo se ve
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          </div>
          <p className="m-0 text-xs leading-normal text-sutil">
            Cualquiera que tenga el enlace puede ver esa página, pero no sale en buscadores. Muestra lo último que guardaste en Mi perfil. Si lo apagás, el enlace deja de
            funcionar; si lo prendés de nuevo, se crea uno nuevo.
          </p>
        </div>
      ) : null}
    </Tarjeta>
  );
}
