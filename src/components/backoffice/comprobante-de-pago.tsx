"use client";

import { useTransition } from "react";
import { adjuntarComprobante, quitarComprobante } from "@/app/actions/backoffice-comprobantes";
import { Boton } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { SubirArchivo } from "@/components/ui/subir-archivo";
import { useToast } from "@/components/ui/toast";
import { CARPETA_COMPROBANTE, nombreDeComprobanteParaMostrar, rutaDeComprobanteDePago, type DestinoDeComprobante } from "@/lib/comprobantes-pago";

/**
 * El comprobante de un pago (la captura o el PDF de la transferencia, el recibo…): sin archivo ofrece «Adjuntar»; con archivo, «Ver comprobante»
 * (abre una URL firmada de un minuto, solo para el equipo) y «Reemplazar» / «Quitar». Es del equipo: la institución no lo ve. Lo que se sube se
 * guarda recién al elegir el archivo (no hay un segundo paso).
 */
export function ComprobanteDePago({
  destino,
  comprobante,
  descripcion,
}: {
  destino: DestinoDeComprobante;
  comprobante: { id: string; nombre: string } | null;
  /** Para lectores de pantalla y para el mensaje: «Noviembre 2026 de Colegio San Andrés». */
  descripcion: string;
}) {
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();

  const guardar = (path: string, nombre?: string) => {
    if (!path) return;
    empezar(async () => {
      try {
        const r = await adjuntarComprobante(destino, { path, nombre: nombre ?? "" });
        toast(r.ok ? `Comprobante de ${descripcion} guardado` : r.error, r.ok ? undefined : "error");
      } catch {
        toast("No pudimos guardar el comprobante. Probá de nuevo.", "error");
      }
    });
  };

  const quitar = async () => {
    if (!comprobante) return;
    if (!(await pedirConfirmacion(`¿Quitar el comprobante de ${descripcion}? Se borra el archivo y no se puede deshacer.`))) return;
    empezar(async () => {
      try {
        const r = await quitarComprobante(comprobante.id);
        toast(r.ok ? "Comprobante quitado" : r.error, r.ok ? undefined : "error");
      } catch {
        toast("No pudimos quitar el comprobante. Probá de nuevo.", "error");
      }
    });
  };

  if (!comprobante) {
    return (
      <SubirArchivo
        bucket="privado"
        carpeta={CARPETA_COMPROBANTE}
        nombre="comprobante"
        variante="boton"
        textoBoton={pendiente ? "Guardando…" : "Adjuntar comprobante"}
        etiqueta={`Comprobante de ${descripcion}`}
        onCambio={guardar}
      />
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <a
        href={rutaDeComprobanteDePago(comprobante.id)}
        target="_blank"
        rel="noopener noreferrer"
        title={nombreDeComprobanteParaMostrar(comprobante.nombre)}
        className="max-w-[180px] truncate text-[13px] font-semibold text-navy-700 hover:underline"
      >
        Ver comprobante
      </a>
      <div className="flex items-center gap-1">
        <SubirArchivo
          key={`${comprobante.id}:${comprobante.nombre}`}
          bucket="privado"
          carpeta={CARPETA_COMPROBANTE}
          nombre="comprobante"
          variante="boton"
          textoBoton={pendiente ? "Guardando…" : "Reemplazar"}
          etiqueta={`Comprobante de ${descripcion}`}
          onCambio={guardar}
        />
        <Boton variante="fantasma" tamano="sm" disabled={pendiente} onClick={quitar} aria-label={`Quitar el comprobante de ${descripcion}`}>
          Quitar
        </Boton>
      </div>
    </div>
  );
}
