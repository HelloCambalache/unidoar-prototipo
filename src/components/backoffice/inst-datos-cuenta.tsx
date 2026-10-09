"use client";

import { useState, useTransition } from "react";
import { actualizarDatosDeInstitucion } from "@/app/actions/backoffice-instituciones";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";

/**
 * Datos de la cuenta que la institución no edita sola (teléfono de contacto, CUIT y CUE). El CUE solo se muestra en los tipos
 * que son establecimientos educativos. El servidor vuelve a validar y deja constancia de qué campos se tocaron.
 */
export function DatosDeCuentaFormulario({
  institucionId,
  inicial,
  conCue,
}: {
  institucionId: string;
  inicial: { telefono: string; cuit: string; cue: string };
  conCue: boolean;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [d, setD] = useState(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const set = (clave: keyof typeof d, valor: string) => {
    setD((p) => ({ ...p, [clave]: valor }));
    setErrores((e) => ({ ...e, [clave]: "" }));
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrores({});
    empezar(async () => {
      try {
        const r = await actualizarDatosDeInstitucion(institucionId, { telefono: d.telefono, cuit: d.cuit, ...(conCue ? { cue: d.cue } : { cue: "" }) });
        if (r.ok) {
          toast("Datos de la cuenta guardados.");
        } else {
          setErrores(r.campos ?? {});
          toast(r.error, "error");
        }
      } catch {
        toast("No pudimos guardar los datos. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-3.5">
      <Campo etiqueta="Teléfono de contacto" error={errores.telefono || undefined}>
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={d.telefono}
          maxLength={40}
          aria-invalid={Boolean(errores.telefono)}
          onChange={(e) => set("telefono", e.target.value)}
        />
      </Campo>
      <Campo etiqueta="CUIT" error={errores.cuit || undefined}>
        <Input value={d.cuit} maxLength={20} autoComplete="off" aria-invalid={Boolean(errores.cuit)} onChange={(e) => set("cuit", e.target.value)} />
      </Campo>
      {conCue && (
        <Campo etiqueta="CUE" error={errores.cue || undefined}>
          <Input value={d.cue} maxLength={20} autoComplete="off" aria-invalid={Boolean(errores.cue)} onChange={(e) => set("cue", e.target.value)} />
        </Campo>
      )}
      <div>
        <Boton type="submit" variante="secundario" tamano="md" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar datos"}
        </Boton>
      </div>
    </form>
  );
}
