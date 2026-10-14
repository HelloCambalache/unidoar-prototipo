"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { borrarCuentaSinTerminar } from "@/app/actions/backoffice-cuentas";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { confirmaElEmail } from "@/lib/baja-cuenta";

/**
 * "Borrar" una cuenta que no terminó el alta: borra de verdad lo que tenga (su fila de usuario, el perfil a medio llenar con su DNI y
 * documentos si los hubiera, sus archivos y su acceso). Pide escribir el email de la cuenta; el servidor lo vuelve a chequear y exige
 * que hayan pasado 24 horas desde el registro.
 */
export function CuentaSinTerminarBorrar({ cuentaId, email, perfilEmpezado }: { cuentaId: string; email: string; perfilEmpezado: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    if (pendiente) return;
    setAbierto(false);
    setTexto("");
    setError(null);
  };

  const confirmar = () =>
    empezar(async () => {
      try {
        const r = await borrarCuentaSinTerminar(cuentaId, { confirmacion: texto });
        if (!r.ok) {
          setError(r.campos?.confirmacion ?? r.error);
          toast(r.error, "error");
          return;
        }
        toast(r.data.pendientes.length > 0 ? `Cuenta borrada, pero falta un paso: ${r.data.pendientes.join(" ")}` : "Cuenta borrada", r.data.pendientes.length > 0 ? "error" : undefined);
        setAbierto(false);
        router.refresh();
      } catch {
        toast("No pudimos completar el borrado. Recargá la lista antes de reintentar: puede haberse borrado.", "error");
      }
    });

  return (
    <>
      <Boton variante="secundario" tamano="sm" onClick={() => setAbierto(true)} className="border-[#E8B4B4] text-[#B42318] hover:border-[#B42318]">
        Borrar
      </Boton>

      <DialogoModal abierto={abierto} onCerrar={cerrar} titulo="¿Borrar esta cuenta?" ancho={500}>
        <p className="m-0 mb-2 text-sm leading-normal text-tinta">
          Se borra <b className="font-semibold">para siempre</b> la cuenta <b className="font-semibold [overflow-wrap:anywhere]">{email}</b>. No se
          puede deshacer.
        </p>
        <ul className="m-0 mb-3 flex list-disc flex-col gap-1 pl-5 text-[13.5px] leading-normal text-tinta-2">
          <li>Su usuario de acceso: no va a poder volver a entrar con ese email ni con Google (si quiere, se registra de nuevo).</li>
          {perfilEmpezado && <li>El perfil que había empezado a llenar, con lo que haya cargado (DNI, documentos, CV y foto).</li>}
          <li>Sus avisos, los mails que se mandaron a ese email y los mensajes que haya enviado por Contacto.</li>
        </ul>
        <p className="m-0 mb-3.5 text-[13px] leading-normal text-apagado">
          Queda anotado en el registro del equipo, sin datos personales. Usalo para cuentas abandonadas o cuando la persona pidió por mail que se
          borre su registro.
        </p>
        <Campo etiqueta={`Para confirmar, escribí el email de la cuenta: ${email}`} error={error ?? undefined}>
          <Input
            value={texto}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setTexto(e.target.value);
              setError(null);
            }}
          />
        </Campo>
        <div className="mt-5 flex justify-end gap-2.5 max-[560px]:flex-col-reverse">
          <Boton variante="secundario" onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Boton>
          <Boton variante="peligro" onClick={confirmar} disabled={pendiente || !confirmaElEmail(texto, email)}>
            {pendiente ? "Borrando…" : "Borrar la cuenta"}
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
