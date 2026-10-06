"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { postular } from "@/app/actions/postulaciones";
import { Boton } from "@/components/ui/button";
import { Campo, Textarea } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";

type Estado = { error: string; campo?: string } | null;

/** "Postularme" con mensaje opcional. Al enviar, la página se vuelve a pintar con el estado de la postulación. */
export function FormularioPostular({ busquedaId }: { busquedaId: string }) {
  const router = useRouter();
  const toast = useToast();

  const [estado, enviar, pendiente] = useActionState(async (_previo: Estado, datos: FormData): Promise<Estado> => {
    const resultado = await postular(busquedaId, String(datos.get("mensaje") ?? ""));
    if (resultado.ok) {
      toast("¡Postulación enviada!");
      return null;
    }
    // Si la búsqueda cambió o ya figurabas, la página tiene que mostrar el estado real.
    router.refresh();
    return { error: resultado.error, campo: resultado.campos?.mensaje };
  }, null);

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <Campo
        etiqueta="Mensaje para la institución (opcional)"
        ayuda="Una línea sobre por qué te interesa el puesto."
        error={estado?.campo}
      >
        <Textarea name="mensaje" maxLength={1000} rows={3} placeholder="Ej. Tengo experiencia en el nivel y puedo empezar en marzo." />
      </Campo>
      <Boton type="submit" variante="cta" bloque disabled={pendiente} className="min-h-12">
        {pendiente ? "Enviando…" : "Postularme"}
      </Boton>
      {estado && !estado.campo && (
        <p role="alert" className="m-0 text-[13px] leading-normal text-[#b91c1c]">
          {estado.error}
        </p>
      )}
    </form>
  );
}
