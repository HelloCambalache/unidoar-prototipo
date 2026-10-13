"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { procesarBajaDocente } from "@/app/actions/backoffice-docentes";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { confirmaElEmail } from "@/lib/baja-cuenta";
import { plural } from "@/lib/busquedas";

/**
 * "Procesar baja": borra de verdad los datos del profesional. Antes de confirmar muestra qué se va a llevar (con los números de
 * esta cuenta) y pide escribir el email de la cuenta; el servidor lo vuelve a chequear. Al terminar la ficha ya no existe, así
 * que vuelve al listado.
 */
export function DocProcesarBaja({
  docenteId,
  nombre,
  email,
  resumen,
  pidioLaBaja,
}: {
  docenteId: string;
  nombre: string;
  /** Email de la cuenta de acceso: lo que hay que escribir para confirmar. */
  email: string;
  resumen: { postulaciones: number; cvEnviados: number; inscripciones: number };
  /** La persona ya pidió la baja desde Mi cuenta. */
  pidioLaBaja: boolean;
}) {
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
        const r = await procesarBajaDocente(docenteId, { confirmacion: texto });
        if (!r.ok) {
          setError(r.campos?.confirmacion ?? r.error);
          toast(r.error, "error");
          return;
        }
        if (r.data.pendientes.length > 0) {
          // La base quedó limpia pero falta un paso a mano: se avisa y se deja la pantalla un rato para poder leerlo.
          toast(`Baja procesada, pero falta un paso: ${r.data.pendientes.join(" ")}`, "error");
        } else {
          toast("Baja procesada: se borraron los datos de la cuenta");
        }
        router.push("/backoffice/docentes");
      } catch {
        toast("No pudimos completar la baja. Mirá si el profesional sigue en el listado antes de reintentar.", "error");
      }
    });

  return (
    <>
      <Boton variante="secundario" bloque onClick={() => setAbierto(true)} className="border-[#E8B4B4] text-[#B42318] hover:border-[#B42318]">
        {pidioLaBaja ? "Procesar baja (pidió la baja)" : "Procesar baja"}
      </Boton>

      <DialogoModal abierto={abierto} onCerrar={cerrar} titulo={`¿Dar de baja a ${nombre}?`} ancho={540}>
        <p className="m-0 mb-2 text-sm leading-normal text-tinta">
          Se borran <b className="font-semibold">para siempre</b> sus datos. No se puede deshacer.
        </p>
        <ul className="m-0 mb-3 flex list-disc flex-col gap-1 pl-5 text-[13.5px] leading-normal text-tinta-2">
          <li>Su perfil y datos personales (DNI, CUIL, domicilio, teléfono, email de contacto).</li>
          <li>Sus documentos, su CV y su foto.</li>
          <li>
            {plural(resumen.postulaciones, "postulación", "postulaciones")} con las notas que las instituciones escribieron
            sobre ellas, y los estudios del examen preocupacional si los hubiera.
          </li>
          <li>
            {plural(resumen.cvEnviados, "CV enviado", "CVs enviados")} a instituciones y{" "}
            {plural(resumen.inscripciones, "inscripción a curso", "inscripciones a cursos")}.
          </li>
          <li>Sus avisos, los mails que se mandaron sobre ella y los mensajes que haya enviado por Contacto.</li>
          <li>Su usuario de acceso: no va a poder volver a entrar con ese email ni con Google.</li>
        </ul>
        <p className="m-0 mb-3.5 text-[13px] leading-normal text-apagado">
          Queda anotado en el registro del equipo que se procesó la baja, sin datos personales. Antes de seguir, confirmá con la
          persona (por email) que fue ella quien la pidió.
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
            {pendiente ? "Borrando…" : "Borrar sus datos y dar de baja"}
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
