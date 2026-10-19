"use client";

import { Boton } from "@/components/ui/button";
import { Input } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";
import { enlaceDeWhatsApp } from "@/lib/compartir-perfil";
import { textoParaRecomendar } from "@/lib/referidos";

/** El enlace personal para recomendar UNIDOAR: se copia o se manda por WhatsApp con el mensaje ya escrito. */
export function CompartirReferido({ url, codigo }: { url: string; codigo: string }) {
  const toast = useToast();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Enlace copiado");
    } catch {
      toast("No pudimos copiarlo solo: seleccioná el enlace y copialo.", "error");
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
        <Boton type="button" variante="primario" onClick={copiar} className="max-[560px]:w-full">
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
      <p className="m-0 text-xs leading-normal text-apagado">
        Tu código es <b className="font-semibold tracking-[.08em] text-tinta">{codigo}</b>. Es personal: cualquier institución que cree su cuenta con este
        enlace queda anotada como recomendada por la tuya.
      </p>
    </div>
  );
}
