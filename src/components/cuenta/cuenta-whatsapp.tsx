"use client";

import { useActionState, useState } from "react";
import { guardarAvisosPorWhatsapp } from "@/app/actions/whatsapp";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Input } from "@/components/ui/campos";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import type { Resultado } from "@/lib/acciones";
import { AYUDA_DEL_CONSENTIMIENTO, TEXTO_DE_LA_CASILLA } from "@/lib/whatsapp/consentimiento";

const QUE_AVISAMOS = {
  docente: "cuando te preseleccionan, te agendan una entrevista o te hacen una oferta",
  institucion: "cuando hay postulantes nuevos en tus búsquedas y cuando un profesional responde a una entrevista",
} as const;

/**
 * Avisos por WhatsApp de Mi cuenta. Solo se muestra cuando los avisos están en marcha (`whatsappActivo`). La casilla viene apagada y el celular se escribe acá:
 * un número que figura en el perfil NO cuenta como consentimiento (puede ir precargado, pero hay que tildar la casilla). Es controlado (React 19 vacía los
 * campos sin controlar después de cada envío).
 */
export function CuentaWhatsapp({
  rol,
  activos,
  numeroEnmascarado,
  telefonoSugerido,
}: {
  rol: "docente" | "institucion";
  activos: boolean;
  /** El número terminado en…, si ya tiene los avisos activos. Nunca el número entero. */
  numeroEnmascarado: string | null;
  /** El teléfono del perfil, para no tener que escribirlo de cero (no activa nada por sí solo). */
  telefonoSugerido: string;
}) {
  const toast = useToast();
  const [quiere, setQuiere] = useState(activos);
  const [telefono, setTelefono] = useState(activos ? "" : telefonoSugerido);
  const [estado, accion, pendiente] = useActionState(async (previo: Resultado | null, formData: FormData) => {
    const r = await guardarAvisosPorWhatsapp(previo, formData);
    if (r.ok) {
      toast(formData.get("activar") === "on" ? "Activamos tus avisos por WhatsApp" : "Dejaste de recibir avisos por WhatsApp");
      setTelefono("");
    }
    return r;
  }, null);
  const error = estado && !estado.ok ? (estado.campos?.telefono ?? estado.error) : null;

  return (
    <Tarjeta como="section" className="p-[22px]">
      <h2 className="m-0 mb-1.5 text-base leading-none font-semibold">Avisos por WhatsApp</h2>
      <p className="m-0 mb-4 text-sm leading-normal text-apagado">
        Te avisamos por WhatsApp {QUE_AVISAMOS[rol]}. Siempre los ves también en la campanita de UNIDOAR.
      </p>
      <form action={accion} noValidate className="flex flex-col gap-3.5">
        <Casilla name="activar" checked={quiere} disabled={pendiente} onChange={(e) => setQuiere(e.target.checked)}>
          {TEXTO_DE_LA_CASILLA}
        </Casilla>
        {quiere && (
          <Campo
            etiqueta="Tu celular"
            ayuda={activos && numeroEnmascarado ? `Hoy los recibís en el ${numeroEnmascarado}. Si escribís otro número, lo cambiamos.` : "Con la característica, por ejemplo 11 5473-5876."}
            error={error ?? undefined}
          >
            <Input
              type="tel"
              name="telefono"
              autoComplete="tel"
              inputMode="tel"
              placeholder={activos ? "Escribí otro número para cambiarlo" : "11 5473-5876"}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              maxLength={40}
              aria-invalid={Boolean(error)}
            />
          </Campo>
        )}
        {!quiere && error && (
          <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
            {error}
          </p>
        )}
        <p className="m-0 text-[12.5px] leading-normal text-apagado">{AYUDA_DEL_CONSENTIMIENTO}</p>
        <div>
          <Boton type="submit" variante="primario" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar"}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
