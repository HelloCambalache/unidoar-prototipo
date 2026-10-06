"use client";

import { useState, useTransition } from "react";
import { reactivarInstitucion, suspenderInstitucion, verificarInstitucion } from "@/app/actions/backoffice-instituciones";
import { BotonWhatsapp } from "@/components/backoffice/inst-whatsapp";
import { Boton } from "@/components/ui/button";
import { Campo, Select, Textarea } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { MOTIVOS_SUSPENSION } from "@/lib/backoffice-instituciones";

type Dialogo = "verificar" | "quitar" | "suspender" | "reactivar" | null;

/**
 * Acciones de la ficha: contactar por WhatsApp, verificar o quitar la verificación, suspender o reactivar.
 * Cada una confirma en un diálogo; el servidor vuelve a validar todo, deja auditoría y avisa a la institución.
 */
export function InstAcciones({
  institucionId,
  nombre,
  verificada,
  suspendida,
  enlaceWhatsapp,
}: {
  institucionId: string;
  nombre: string;
  verificada: boolean;
  suspendida: boolean;
  enlaceWhatsapp: string | null;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    setDialogo(null);
    setMotivo("");
    setNota("");
    setError(null);
  };

  const ejecutar = (accion: () => Promise<{ ok: boolean; error?: string }>, exito: string) => {
    setError(null);
    empezar(async () => {
      try {
        const r = await accion();
        if (!r.ok) {
          setError(r.error ?? "No pudimos completar la acción.");
          toast(r.error ?? "No pudimos completar la acción.", "error");
          return;
        }
        toast(exito);
        cerrar();
      } catch {
        toast("No pudimos completar la acción. Probá de nuevo.", "error");
      }
    });
  };

  const confirmarSuspension = () => {
    if (!motivo) {
      setError("Elegí el motivo de la suspensión.");
      return;
    }
    ejecutar(() => suspenderInstitucion(institucionId, { motivo, nota }), "Cuenta suspendida");
  };

  const texto = "m-0 mb-4 text-sm leading-normal text-apagado";

  return (
    <>
      <div className="flex flex-col gap-2">
        <BotonWhatsapp href={enlaceWhatsapp}>Contactar por WhatsApp</BotonWhatsapp>
        <Boton variante="secundario" bloque onClick={() => setDialogo(verificada ? "quitar" : "verificar")}>
          {verificada ? "Quitar verificación" : "Verificar institución"}
        </Boton>
        {suspendida ? (
          <Boton variante="secundario" bloque onClick={() => setDialogo("reactivar")} className="border-navy-700 text-navy-700">
            Reactivar cuenta
          </Boton>
        ) : (
          <Boton
            variante="secundario"
            bloque
            onClick={() => setDialogo("suspender")}
            className="border-[#EBCFC5] text-[#8F3D28] hover:border-[#EBCFC5] hover:bg-[#F6E6E0]"
          >
            Suspender cuenta
          </Boton>
        )}
      </div>

      <DialogoModal abierto={dialogo === "verificar"} onCerrar={cerrar} titulo={`¿Verificar a ${nombre}?`}>
        <p className={texto}>
          La institución va a mostrar el sello de verificada en su perfil público y en sus búsquedas. Le avisamos a
          las personas de su equipo.
        </p>
        <div className="flex gap-2.5">
          <Boton disabled={pendiente} onClick={() => ejecutar(() => verificarInstitucion(institucionId, true), "Institución verificada")}>
            {pendiente ? "Verificando…" : "Verificar"}
          </Boton>
          <Boton variante="secundario" disabled={pendiente} onClick={cerrar}>
            Cancelar
          </Boton>
        </div>
      </DialogoModal>

      <DialogoModal abierto={dialogo === "quitar"} onCerrar={cerrar} titulo={`¿Quitar la verificación a ${nombre}?`}>
        <p className={texto}>
          Deja de mostrar el sello de verificada en su perfil público y en sus búsquedas. Le avisamos a las personas de su
          equipo.
        </p>
        <div className="flex gap-2.5">
          <Boton
            variante="peligro"
            disabled={pendiente}
            onClick={() => ejecutar(() => verificarInstitucion(institucionId, false), "Verificación quitada")}
          >
            {pendiente ? "Quitando…" : "Quitar verificación"}
          </Boton>
          <Boton variante="secundario" disabled={pendiente} onClick={cerrar}>
            Cancelar
          </Boton>
        </div>
      </DialogoModal>

      <DialogoModal abierto={dialogo === "suspender"} onCerrar={cerrar} titulo={`¿Suspender a ${nombre}?`}>
        <p className={texto}>
          Nadie del equipo de la institución va a poder entrar a su área hasta que reactives la cuenta. Los datos se
          conservan y se le avisa, con el motivo.
        </p>
        <div className="mb-3 flex flex-col gap-3">
          <Campo etiqueta="Motivo" requerido error={error ?? undefined}>
            <Select value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-invalid={!!error || undefined}>
              <option value="">Elegí un motivo</option>
              {MOTIVOS_SUSPENSION.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Nota interna" ayuda="Queda en el registro del equipo; la institución no la ve.">
            <Textarea value={nota} maxLength={500} rows={3} placeholder="Opcional" onChange={(e) => setNota(e.target.value)} />
          </Campo>
        </div>
        <div className="flex gap-2.5">
          <Boton variante="peligro" disabled={pendiente} onClick={confirmarSuspension}>
            {pendiente ? "Suspendiendo…" : "Suspender cuenta"}
          </Boton>
          <Boton variante="secundario" disabled={pendiente} onClick={cerrar}>
            Cancelar
          </Boton>
        </div>
      </DialogoModal>

      <DialogoModal abierto={dialogo === "reactivar"} onCerrar={cerrar} titulo={`¿Reactivar a ${nombre}?`}>
        <p className={texto}>El equipo de la institución vuelve a entrar a su área. Le avisamos.</p>
        <div className="flex gap-2.5">
          <Boton disabled={pendiente} onClick={() => ejecutar(() => reactivarInstitucion(institucionId), "Cuenta reactivada")}>
            {pendiente ? "Reactivando…" : "Reactivar cuenta"}
          </Boton>
          <Boton variante="secundario" disabled={pendiente} onClick={cerrar}>
            Cancelar
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
