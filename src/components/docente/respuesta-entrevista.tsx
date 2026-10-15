"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { responderEntrevista } from "@/app/actions/postulaciones";
import { Icono } from "@/components/icons";
import { Textarea } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";
import { MAX_MENSAJE_RESPUESTA, type RespuestaEntrevista as Respuesta } from "@/lib/entrevista-respuesta";
import type { DetallePostulacion } from "@/lib/queries/postulaciones";
import { cn } from "@/lib/utils";

/**
 * "¿Vas a la entrevista?": Voy / No puedo (con un mensaje opcional para la institución). Los botones del mail llegan con
 * `?entrevista=voy|no-puedo` y solo preseleccionan: la respuesta se manda recién con un toque acá, con la sesión abierta
 * (así un antivirus que abre los enlaces del mail no responde solo).
 */
export function RespuestaEntrevista({
  postulacionId,
  datos,
  sugerida,
}: {
  postulacionId: string;
  datos: NonNullable<DetallePostulacion["respuestaEntrevista"]>;
  sugerida: Respuesta | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  // Sin respuesta guardada, se abre directo en lo que eligió en el mail; con respuesta, se muestra y se puede cambiar.
  const [editando, setEditando] = useState(datos.respuesta === null || (sugerida !== null && sugerida !== datos.respuesta));
  const [eleccion, setEleccion] = useState<Respuesta | null>(sugerida ?? datos.respuesta);
  const [mensaje, setMensaje] = useState(datos.mensaje ?? "");
  const [error, setError] = useState<string | null>(null);

  const enviar = (respuesta: Respuesta) =>
    empezar(async () => {
      setError(null);
      const r = await responderEntrevista(postulacionId, {
        respuesta,
        mensaje: respuesta === "no_puedo" ? mensaje : undefined,
        para: datos.para,
      });
      if (!r.ok) return setError(r.error);
      toast(respuesta === "voy" ? "Le avisamos a la institución que vas" : "Le avisamos a la institución que no podés");
      setEditando(false);
      router.refresh();
    });

  if (!datos.abierta) {
    return datos.respuesta ? (
      <p className="m-0 mt-3 text-[12.5px] leading-snug text-verde">
        Respondiste: {datos.respuesta === "voy" ? "voy" : "no puedo"}.
      </p>
    ) : null;
  }

  if (!editando && datos.respuesta) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[13px] font-semibold",
            datos.respuesta === "voy" ? "text-verde" : "text-naranja-ink",
          )}
        >
          <Icono nombre={datos.respuesta === "voy" ? "tilde" : "cerrar"} tamano={14} trazo={2.4} />
          {datos.respuesta === "voy" ? "Confirmaste que vas" : "Avisaste que no podés"}
        </span>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="ml-auto rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-tinta-2 hover:bg-white hover:text-tinta"
        >
          Cambiar respuesta
        </button>
        {datos.respuesta === "no_puedo" && datos.mensaje && (
          <p className="m-0 basis-full text-[12.5px] leading-snug text-apagado">Tu mensaje: «{datos.mensaje}»</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-white/80 p-3">
      <div className="mb-2 text-[13px] font-semibold text-tinta">¿Vas a la entrevista?</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => enviar("voy")}
          disabled={pendiente}
          aria-pressed={eleccion === "voy"}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold transition-colors disabled:opacity-60",
            eleccion === "voy" ? "bg-verde text-white hover:bg-[#186a41]" : "border border-[#B9E3CE] bg-white text-verde hover:bg-verde-tint",
          )}
        >
          <Icono nombre="tilde" tamano={15} trazo={2.4} />
          Voy
        </button>
        <button
          type="button"
          onClick={() => setEleccion("no_puedo")}
          disabled={pendiente}
          aria-pressed={eleccion === "no_puedo"}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold transition-colors disabled:opacity-60",
            eleccion === "no_puedo" ? "bg-naranja-tint text-naranja-ink ring-1 ring-naranja/40" : "border border-borde bg-white text-tinta-2 hover:bg-lienzo",
          )}
        >
          No puedo
        </button>
      </div>
      {eleccion === "no_puedo" && (
        <div className="mt-2.5 flex flex-col gap-2">
          <label htmlFor={`mensaje-entrevista-${postulacionId}`} className="text-[12.5px] font-medium text-tinta-2">
            Contale a la institución qué día u horario te queda bien (opcional)
          </label>
          <Textarea
            id={`mensaje-entrevista-${postulacionId}`}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            maxLength={MAX_MENSAJE_RESPUESTA}
            placeholder="Ej.: Ese día trabajo, pero el viernes a la tarde puedo."
            className="min-h-[70px] text-[13px]"
          />
          <button
            type="button"
            onClick={() => enviar("no_puedo")}
            disabled={pendiente}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-naranja text-[14px] font-semibold text-white hover:bg-[#c44a35] disabled:opacity-60"
          >
            {pendiente ? "Enviando…" : "Avisar que no puedo"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="m-0 mt-2 text-xs text-[#b91c1c]">
          {error}
        </p>
      )}
    </div>
  );
}
