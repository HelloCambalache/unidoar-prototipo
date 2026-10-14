"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { postular } from "@/app/actions/postulaciones";
import { Boton } from "@/components/ui/button";
import { Campo, Textarea } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";

type Estado = { error: string; campo?: string } | null;

/**
 * "Postularme" con mensaje opcional. Al enviar, la página se vuelve a pintar con el estado de la postulación. Con `invitada` (la
 * institución ya la invitó), es "Aceptar la invitación": la misma acción convierte la invitación en una postulación y la institución
 * pasa a ver su teléfono y su email.
 */
export function FormularioPostular({ busquedaId, invitada = false }: { busquedaId: string; invitada?: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [estado, enviar, pendiente] = useActionState(async (_previo: Estado, datos: FormData): Promise<Estado> => {
    const resultado = await postular(busquedaId, String(datos.get("mensaje") ?? ""));
    if (resultado.ok) {
      toast(invitada ? "¡Listo! Aceptaste la invitación: la institución ya puede ver tus datos de contacto." : "¡Postulación enviada!");
      // Con una invitación la página ya está pintada como "invitada": hay que volver a pintarla con el estado nuevo.
      if (invitada) router.refresh();
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
        ayuda={invitada ? "Una línea para responder a la invitación." : "Una línea sobre por qué te interesa el puesto."}
        error={estado?.campo}
      >
        <Textarea name="mensaje" maxLength={1000} rows={3} placeholder="Ej. Tengo experiencia en el nivel y puedo empezar en marzo." />
      </Campo>
      <Boton type="submit" variante="cta" bloque disabled={pendiente} className="min-h-12">
        {pendiente ? "Enviando…" : invitada ? "Aceptar la invitación y postularme" : "Postularme"}
      </Boton>
      {estado && !estado.campo && (
        <p role="alert" className="m-0 text-[13px] leading-normal text-[#b91c1c]">
          {estado.error}
        </p>
      )}
    </form>
  );
}
