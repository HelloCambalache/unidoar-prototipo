"use client";

import Link from "next/link";
import { useTransition } from "react";
import { marcarLeida, marcarTodasLeidas } from "@/app/actions/notificaciones";
import { Boton } from "@/components/ui/button";
import { estiloNotificacion, type NotificacionVista } from "@/lib/notificaciones";
import { cn } from "@/lib/utils";

/** Lista completa de notificaciones. Abrir una la marca como leída y lleva a su enlace, si tiene. */
export function ListaNotificaciones({ notificaciones }: { notificaciones: NotificacionVista[] }) {
  const [, empezar] = useTransition();
  const marcar = (n: NotificacionVista) => {
    if (!n.leida) empezar(() => void marcarLeida(n.id));
  };

  return (
    <ul className="m-0 flex max-w-[900px] list-none flex-col gap-2.5 p-0">
      {notificaciones.map((n) => {
        const estilo = estiloNotificacion(n.tipo, n.titulo);
        const clases = cn(
          "flex w-full items-start gap-[11px] rounded-caja border border-borde p-3.5 text-left transition-colors",
          n.leida ? "bg-white" : "bg-superficie",
          (n.enlace || !n.leida) && "hover:bg-[#F0EFEA]",
          "focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
        );
        const contenido = (
          <>
            <span
              aria-hidden
              style={{ background: estilo.fondo, color: estilo.texto }}
              className="inline-flex size-[34px] flex-none items-center justify-center rounded-full text-xs font-semibold"
            >
              {estilo.ini}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-[1.4] text-tinta-2">
                <b className="font-semibold text-tinta">{n.titulo}</b> {n.texto}
              </span>
              <span className="mt-[3px] block text-xs leading-none text-sutil">{n.cuando}</span>
            </span>
            {!n.leida && (
              <span className="mt-1.5 size-2 flex-none rounded-full bg-rosa">
                <span className="sr-only">Sin leer</span>
              </span>
            )}
          </>
        );
        return (
          <li key={n.id}>
            {n.enlace ? (
              <Link href={n.enlace} onClick={() => marcar(n)} className={cn(clases, "text-inherit hover:text-inherit")}>
                {contenido}
              </Link>
            ) : n.leida ? (
              <div className={clases}>{contenido}</div>
            ) : (
              <button type="button" onClick={() => marcar(n)} className={clases}>
                {contenido}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function BotonMarcarTodasLeidas() {
  const [pendiente, empezar] = useTransition();
  return (
    <Boton variante="secundario" tamano="sm" disabled={pendiente} onClick={() => empezar(() => void marcarTodasLeidas())}>
      Marcar todas como leídas
    </Boton>
  );
}
