"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { procesarBajaInstitucion } from "@/app/actions/backoffice-instituciones";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { confirmaElTexto } from "@/lib/baja-cuenta";
import { plural } from "@/lib/busquedas";
import type { ResumenDeBajaInstitucion } from "@/lib/queries/baja-institucion";

/**
 * "Procesar baja": borra de verdad los datos de la institución y conserva solo lo fiscal. Antes de confirmar muestra qué se va a llevar
 * (con los números de esta cuenta) y qué queda, y pide escribir el nombre de la institución; el servidor lo vuelve a chequear. Al terminar
 * la ficha sigue existiendo (como registro fiscal "dada de baja"), así que se queda en ella.
 */
export function InstProcesarBaja({
  institucionId,
  nombre,
  resumen,
  pidioLaBaja,
}: {
  institucionId: string;
  nombre: string;
  resumen: ResumenDeBajaInstitucion;
  /** La institución ya pidió la baja desde Mi cuenta. */
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
        const r = await procesarBajaInstitucion(institucionId, { confirmacion: texto });
        if (!r.ok) {
          setError(r.campos?.confirmacion ?? r.error);
          toast(r.error, "error");
          return;
        }
        if (r.data.pendientes.length > 0) {
          // La base quedó limpia pero falta un paso a mano: se avisa para poder leerlo.
          toast(`Baja procesada, pero falta un paso: ${r.data.pendientes.join(" ")}`, "error");
        } else {
          toast("Baja procesada: se borraron los datos de la institución");
        }
        setAbierto(false);
        router.refresh();
      } catch {
        toast("No pudimos completar la baja. Recargá la ficha antes de reintentar: puede haberse procesado.", "error");
      }
    });

  return (
    <>
      <Boton variante="secundario" bloque onClick={() => setAbierto(true)} className="border-[#E8B4B4] text-[#B42318] hover:border-[#B42318]">
        {pidioLaBaja ? "Procesar baja (pidió la baja)" : "Procesar baja"}
      </Boton>

      <DialogoModal abierto={abierto} onCerrar={cerrar} titulo={`¿Dar de baja a ${nombre}?`} ancho={560}>
        <p className="m-0 mb-2 text-sm leading-normal text-tinta">
          Se borran <b className="font-semibold">para siempre</b> estos datos. No se puede deshacer.
        </p>
        <ul className="m-0 mb-3 flex list-disc flex-col gap-1 pl-5 text-[13.5px] leading-normal text-tinta-2">
          <li>
            Su equipo ({plural(resumen.equipo, "persona", "personas")}) y sus cuentas de acceso: no van a poder volver a entrar con ese
            email ni con Google.
          </li>
          <li>
            {plural(resumen.busquedas, "búsqueda", "búsquedas")} con {plural(resumen.postulaciones, "postulación", "postulaciones")}{" "}
            y las notas que se escribieron, y los estudios del examen preocupacional si los hubiera.
          </li>
          <li>
            {plural(resumen.cursos, "curso", "cursos")} con sus inscripciones, y{" "}
            {plural(resumen.contactos, "contacto privado", "contactos privados")} cargados por la institución.
          </li>
          <li>Su perfil público (descripción, logo, portada, galería y novedades), las sedes y el teléfono y la persona de contacto.</li>
          <li>Sus avisos, los mails que se mandaron sobre ella y los mensajes que su equipo haya enviado por Contacto.</li>
        </ul>
        <p className="m-0 mb-2 text-sm leading-normal text-tinta">
          <b className="font-semibold">Se conserva</b>, por obligación fiscal:
        </p>
        <ul className="m-0 mb-3 flex list-disc flex-col gap-1 pl-5 text-[13.5px] leading-normal text-tinta-2">
          <li>Su nombre, tipo, CUIT, condición fiscal y domicilio.</li>
          <li>
            {plural(resumen.facturas, "factura", "facturas")} con su historial de cobros
            {resumen.facturasImpagas > 0 && (
              <>
                {" "}
                (<b className="font-semibold">{plural(resumen.facturasImpagas, "sin pagar", "sin pagar")}</b>: la deuda no se borra, hay que
                gestionarla aparte)
              </>
            )}
            .
          </li>
        </ul>
        <p className="m-0 mb-3.5 text-[13px] leading-normal text-apagado">
          Queda anotado en el registro del equipo que se procesó la baja, sin datos personales. Antes de seguir, confirmá con la
          institución (por email) que fue ella quien la pidió y que ya se canceló su suscripción.
        </p>
        <Campo etiqueta={`Para confirmar, escribí el nombre de la institución: ${nombre}`} error={error ?? undefined}>
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
          <Boton variante="peligro" onClick={confirmar} disabled={pendiente || !confirmaElTexto(texto, nombre)}>
            {pendiente ? "Borrando…" : "Borrar sus datos y dar de baja"}
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
