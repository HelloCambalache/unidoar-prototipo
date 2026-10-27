"use client";

import { useState, useSyncExternalStore } from "react";
import { Icono } from "@/components/icons";
import { botonClases, Boton, type BotonTamano, type BotonVariante } from "@/components/ui/button";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { Input } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";
import { CANALES, enlaceDeCanal, type Mensaje } from "@/lib/compartir";
import { cn } from "@/lib/utils";

/** ¿El navegador tiene el compartir nativo (hoja de «Compartir» del celular)? En el servidor no, así que el primer dibujo coincide y después se suma. */
const hayCompartirNativo = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const sinSuscripcion = () => () => {};

/**
 * Botón «Compartir»: abre un cuadro con el enlace para copiar, el compartir del celular (si el dispositivo lo tiene) y los canales de
 * `CANALES` (WhatsApp, Facebook, LinkedIn, X y correo) con el mensaje ya armado. Qué se comparte lo decide quien lo usa con `mensaje`
 * (reglas y textos en src/lib/compartir.ts); la dirección tiene que venir completa, con el origen del sitio.
 */
export function BotonCompartir({
  mensaje,
  titulo = "Compartir",
  etiqueta = "Compartir",
  bajada,
  variante = "secundario",
  tamano = "sm",
  className,
}: {
  mensaje: Mensaje;
  /** Título del cuadro («Compartir esta búsqueda»). */
  titulo?: string;
  /** Texto del botón. */
  etiqueta?: string;
  /** Una línea debajo del título que aclara qué ve quien abre el enlace. */
  bajada?: string;
  variante?: BotonVariante;
  tamano?: BotonTamano;
  className?: string;
}) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const nativo = useSyncExternalStore(sinSuscripcion, hayCompartirNativo, () => false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje.url);
      toast("Enlace copiado");
    } catch {
      // Sin permiso para el portapapeles: se deja el enlace seleccionado para copiarlo a mano.
      document.getElementById("compartir-enlace")?.focus();
      toast("No pudimos copiarlo solo: seleccioná el enlace y copialo.", "error");
    }
  };

  const compartirNativo = async () => {
    try {
      await navigator.share({ title: mensaje.asunto, text: mensaje.texto, url: mensaje.url });
      setAbierto(false);
    } catch {
      // Cerrar la hoja sin elegir nada también llega como error: no es una falla que haya que avisar.
    }
  };

  return (
    <>
      <Boton variante={variante} tamano={tamano} className={className} onClick={() => setAbierto(true)}>
        <Icono nombre="compartir" tamano={tamano === "sm" ? 14 : 16} trazo={2} />
        {etiqueta}
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo={titulo} ancho={480}>
        {bajada && <p className="mt-0 mb-4 text-[13.5px] leading-normal text-apagado">{bajada}</p>}

        <div className="flex gap-2">
          <Input
            id="compartir-enlace"
            readOnly
            value={mensaje.url}
            aria-label="Enlace para compartir"
            onFocus={(e) => e.currentTarget.select()}
            // Este botón también se usa dentro de formularios (Mi perfil): un Enter acá no tiene que guardarlos.
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            className="min-w-0 flex-1 bg-superficie text-[13px]"
          />
          <Boton type="button" variante="primario" onClick={copiar} className="flex-none">
            <Icono nombre="copiar" tamano={15} trazo={2} />
            Copiar
          </Boton>
        </div>

        {nativo && (
          <Boton type="button" variante="cta" bloque onClick={compartirNativo} className="mt-3">
            <Icono nombre="compartir" tamano={16} trazo={2} />
            Compartir desde este dispositivo
          </Boton>
        )}

        <div className="mt-4 mb-1 text-xs font-semibold text-apagado">O elegí dónde</div>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 max-[420px]:grid-cols-1">
          {CANALES.map(({ canal, etiqueta: nombre }) => (
            <li key={canal}>
              <a
                href={enlaceDeCanal(canal, mensaje)}
                // El correo abre el programa de mail en esta misma pestaña; los demás, una pestaña nueva.
                {...(canal === "correo" ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                className={cn(botonClases({ variante: "secundario", tamano: "md", bloque: true }), "justify-start")}
              >
                {nombre}
                {canal !== "correo" && <span className="sr-only"> (se abre en una pestaña nueva)</span>}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end">
          <Boton type="button" variante="fantasma" onClick={() => setAbierto(false)}>
            Cerrar
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
