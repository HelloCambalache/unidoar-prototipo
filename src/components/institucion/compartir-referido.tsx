"use client";

import { Boton } from "@/components/ui/button";
import { Input } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";
import { enlaceDeWhatsApp } from "@/lib/compartir-perfil";
import { textoParaRecomendar } from "@/lib/referidos";

/** El enlace personal para recomendar UNIDOAR: se copia o se manda por WhatsApp con el mensaje ya escrito. */
export function CompartirReferido({ url, codigo }: { url: string; codigo: string }) {
  const toast = useToast();

  const copiar = async (texto: string, aviso: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast(aviso);
    } catch {
      toast("No pudimos copiarlo solo: seleccionalo y copialo.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-2.5">
        <Input
          readOnly
          value={url}
          aria-label="Tu enlace para recomendar UNIDOAR"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-[240px] flex-1 bg-superficie text-[13.5px]"
        />
        <Boton type="button" variante="primario" onClick={() => copiar(url, "Enlace copiado")} className="max-[560px]:w-full">
          Copiar enlace
        </Boton>
        <a
          href={enlaceDeWhatsApp(textoParaRecomendar(url))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-borde bg-white px-[22px] text-sm font-semibold text-tinta transition-colors hover:border-borde-fuerte hover:bg-superficie max-[560px]:w-full"
        >
          Recomendar por WhatsApp
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs leading-normal text-apagado">
        <span>
          Tu código es <b className="text-[13px] font-semibold tracking-[.08em] text-tinta">{codigo}</b>.
        </span>
        <button
          type="button"
          onClick={() => copiar(codigo, "Código copiado")}
          className="rounded-md px-1.5 py-1 text-xs font-semibold text-navy-700 hover:underline focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
        >
          Copiar código
        </button>
      </div>
      <p className="m-0 text-xs leading-normal text-apagado">
        Es personal: cualquier institución que cree su cuenta con este enlace —o que escriba tu código al crearla— queda anotada como recomendada por la
        tuya.
      </p>
    </div>
  );
}
