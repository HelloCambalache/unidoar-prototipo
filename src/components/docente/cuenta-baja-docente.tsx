"use client";

import { useActionState, useState, useTransition } from "react";
import { retirarBajaDocente, solicitarBajaDocente } from "@/app/actions/cuenta";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import type { Resultado } from "@/lib/acciones";

const comparable = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();

function FormularioBaja({ email, onCerrar }: { email: string; onCerrar: () => void }) {
  const toast = useToast();
  const [escrito, setEscrito] = useState("");
  const [estado, accion, pendiente] = useActionState<Resultado | null, FormData>(async (previo, formData) => {
    const r = await solicitarBajaDocente(previo, formData);
    if (r.ok) {
      toast("Recibimos tu pedido de baja. El equipo se va a contactar con vos.");
      onCerrar();
    }
    return r;
  }, null);
  const error = estado && !estado.ok ? (estado.campos?.confirmacion ?? estado.error) : undefined;
  const coincide = comparable(escrito) === comparable(email);

  return (
    <form action={accion}>
      <p className="m-0 mb-3 text-sm leading-[1.6] text-apagado">
        Pedir la baja <strong className="text-tinta">no borra nada todavía</strong>: el equipo de UNIDOAR recibe tu pedido y se
        contacta con vos a <strong className="text-tinta">{email}</strong> para confirmarlo y dar de baja tu perfil. Hasta
        entonces tu cuenta sigue funcionando igual, y podés retirar el pedido cuando quieras.
      </p>
      <Campo etiqueta={`Para confirmar, escribí el email de tu cuenta: ${email}`} error={error} className="mb-5">
        <Input
          name="confirmacion"
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
          autoComplete="off"
          autoFocus
          placeholder={email}
          aria-invalid={Boolean(error)}
        />
      </Campo>
      <div className="flex gap-2 max-[560px]:flex-col">
        <Boton variante="secundario" bloque onClick={onCerrar}>
          Mejor no
        </Boton>
        <Boton type="submit" variante="peligro" bloque disabled={!coincide || pendiente} aria-busy={pendiente}>
          {pendiente ? "Enviando…" : "Pedir la baja"}
        </Boton>
      </div>
    </form>
  );
}

/**
 * "Darse de baja" del docente: un pedido con confirmación (escribir el email de la cuenta). No borra nada: lo procesa
 * el equipo de UNIDOAR, que se contacta por email. Mismo criterio que la baja de la institución.
 */
export function CuentaBajaDocente({
  email,
  solicitadaEl,
}: {
  email: string;
  /** Fecha ya formateada del pedido en curso, o null si no hay. */
  solicitadaEl: string | null;
}) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [retirando, empezar] = useTransition();

  const retirar = () =>
    empezar(async () => {
      try {
        const r = await retirarBajaDocente();
        if (r.ok) toast("Retiraste el pedido de baja. Tu cuenta sigue igual.");
        else toast(r.error, "error");
      } catch {
        toast("No pudimos retirar el pedido. Probá de nuevo.", "error");
      }
    });

  return (
    <Tarjeta como="section" className="p-[22px]">
      <h2 className="m-0 mb-1.5 text-base leading-none font-semibold">Darse de baja</h2>
      {solicitadaEl ? (
        <>
          <p className="m-0 mb-4 text-sm leading-normal text-apagado">
            Pediste la baja el <strong className="text-tinta">{solicitadaEl}</strong>. El equipo de UNIDOAR se va a contactar con vos
            a <strong className="text-tinta">{email}</strong> para confirmarla. Mientras tanto tu perfil y tus postulaciones siguen
            activos.
          </p>
          <Boton variante="secundario" onClick={retirar} disabled={retirando} aria-busy={retirando}>
            {retirando ? "Retirando…" : "Retirar el pedido"}
          </Boton>
        </>
      ) : (
        <>
          <p className="m-0 mb-4 text-sm leading-normal text-apagado">
            Pedí la baja de tu cuenta: el equipo de UNIDOAR se contacta con vos para confirmarla y dar de baja tu perfil. No se
            borra nada hasta que lo confirmemos juntos.
          </p>
          <Boton
            variante="secundario"
            onClick={() => setAbierto(true)}
            className="border-[#DC2626] text-[#DC2626] hover:border-[#DC2626] hover:bg-[#DC2626] hover:text-white"
          >
            Darme de baja
          </Boton>
          <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="¿Querés darte de baja?" ancho={460}>
            <div className="mt-3">
              <FormularioBaja email={email} onCerrar={() => setAbierto(false)} />
            </div>
          </DialogoModal>
        </>
      )}
    </Tarjeta>
  );
}
