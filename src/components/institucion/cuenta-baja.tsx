"use client";

import { useActionState, useState, useTransition } from "react";
import { retirarBajaCuenta, solicitarBajaCuenta } from "@/app/actions/institucion";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import type { Resultado } from "@/lib/acciones";

const comparable = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();

function FormularioBaja({ nombreInstitucion, email, onCerrar }: { nombreInstitucion: string; email: string; onCerrar: () => void }) {
  const toast = useToast();
  const [escrito, setEscrito] = useState("");
  const [estado, accion, pendiente] = useActionState<Resultado | null, FormData>(async (previo, formData) => {
    const r = await solicitarBajaCuenta(previo, formData);
    if (r.ok) {
      toast("Recibimos tu pedido de baja. El equipo se va a contactar con vos.");
      onCerrar();
    }
    return r;
  }, null);
  const error = estado && !estado.ok ? (estado.campos?.confirmacion ?? estado.error) : undefined;
  const coincide = comparable(escrito) === comparable(nombreInstitucion);

  return (
    <form action={accion}>
      <p className="m-0 mb-3 text-sm leading-[1.6] text-apagado">
        Pedir la baja <strong className="text-tinta">no borra nada todavía</strong>: el equipo de UNIDOAR recibe tu pedido y se
        contacta con vos a <strong className="text-tinta">{email}</strong> para confirmarlo y coordinar el cierre (plan, búsquedas
        abiertas y vitrina). Hasta entonces tu cuenta sigue funcionando igual, y podés retirar el pedido cuando quieras.
      </p>
      <Campo etiqueta={`Para confirmar, escribí el nombre de tu institución: ${nombreInstitucion}`} error={error} className="mb-5">
        <Input
          name="confirmacion"
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
          autoComplete="off"
          autoFocus
          placeholder={nombreInstitucion}
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
 * "Darse de baja": un pedido con confirmación fuerte (escribir el nombre de la institución). No cancela ni
 * despublica nada: lo procesa el equipo de UNIDOAR, que se contacta por email. Solo lo ve el dueño de la cuenta.
 */
export function CuentaBaja({
  nombreInstitucion,
  email,
  esDueno,
  solicitadaEl,
}: {
  nombreInstitucion: string;
  email: string;
  esDueno: boolean;
  /** Fecha ya formateada del pedido en curso, o null si no hay. */
  solicitadaEl: string | null;
}) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [retirando, empezar] = useTransition();

  const retirar = () =>
    empezar(async () => {
      try {
        const r = await retirarBajaCuenta();
        if (r.ok) toast("Retiraste el pedido de baja. Tu cuenta sigue igual.");
        else toast(r.error, "error");
      } catch {
        toast("No pudimos retirar el pedido. Probá de nuevo.", "error");
      }
    });

  return (
    <Tarjeta como="section" className="p-[22px]">
      <h2 className="m-0 mb-1.5 text-base leading-none font-semibold">Darse de baja</h2>
      {!esDueno ? (
        <p className="m-0 text-sm leading-normal text-apagado">Solo el dueño de la cuenta puede pedir la baja de la institución.</p>
      ) : solicitadaEl ? (
        <>
          <p className="m-0 mb-4 text-sm leading-normal text-apagado">
            Pediste la baja el <strong className="text-tinta">{solicitadaEl}</strong>. El equipo de UNIDOAR se va a contactar con vos a{" "}
            <strong className="text-tinta">{email}</strong> para confirmarla. Mientras tanto tu plan, tus búsquedas y tu vitrina siguen
            activos.
          </p>
          <Boton variante="secundario" onClick={retirar} disabled={retirando} aria-busy={retirando}>
            {retirando ? "Retirando…" : "Retirar el pedido"}
          </Boton>
        </>
      ) : (
        <>
          <p className="m-0 mb-4 text-sm leading-normal text-apagado">
            Pedí la baja de la cuenta y de la institución: el equipo de UNIDOAR se contacta con vos para cancelar la suscripción,
            despublicar tus búsquedas y dar de baja la vitrina. No se borra nada hasta que lo confirmemos juntos. Al procesar la baja se
            borran tu equipo, tus búsquedas, los cursos, los contactos y el perfil público; solo conservamos tus facturas y los datos que
            figuran en ellas (nombre, CUIT y domicilio), que la ley nos obliga a guardar.
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
              <FormularioBaja nombreInstitucion={nombreInstitucion} email={email} onCerrar={() => setAbierto(false)} />
            </div>
          </DialogoModal>
        </>
      )}
    </Tarjeta>
  );
}
