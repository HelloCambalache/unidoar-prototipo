"use client";

import { useState, useTransition } from "react";
import { pedirCorreccion, rechazarDocente, verificarDocente } from "@/app/actions/backoffice-verificacion";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Textarea } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";
import { EtiquetaSeccion } from "@/components/ui/tarjeta";

type Props = {
  docenteId: string;
  nombre: string;
  /** Nombre de la credencial según la categoría ("Título docente", "Libreta de guardavidas…"). */
  credencial: string;
  /** Qué hay realmente cargado: sirve para avisar antes de verificar algo que no se pudo revisar en la plataforma. */
  tiene: { dni: boolean; credencial: boolean; conducta: boolean };
  /** Quien todavía estudia no tiene título que revisar. */
  credencialNoAplica: boolean;
};

const MIN_MOTIVO = 5;

/**
 * Revisión de un docente de la cola: casillas por documento revisado y tres acciones.
 * Verificar exige haber revisado la identidad; pedir corrección y rechazar exigen un motivo (que le llega al docente).
 */
export function VerifAcciones({ docenteId, nombre, credencial, tiene, credencialNoAplica }: Props) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [identidad, setIdentidad] = useState(false);
  const [titulo, setTitulo] = useState(false);
  const [antecedentes, setAntecedentes] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorRevision, setErrorRevision] = useState<string | null>(null);
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const idMotivo = `motivo-verif-${docenteId}`;

  const ejecutar = (accion: () => ReturnType<typeof verificarDocente>, exito: string, alTerminar?: () => void) => {
    empezar(async () => {
      try {
        const r = await accion();
        if (!r.ok) {
          toast(r.error, "error");
          return;
        }
        toast(exito);
        alTerminar?.();
      } catch {
        toast("No pudimos completar la acción. Probá de nuevo.", "error");
      }
    });
  };

  const verificar = () => {
    setErrorMotivo(null);
    if (!identidad) {
      setErrorRevision("Tildá «Revisé el DNI» para poder verificar.");
      return;
    }
    setErrorRevision(null);
    const faltan = [
      ...(tiene.dni ? [] : ["el DNI (frente y dorso)"]),
      ...(titulo && !tiene.credencial ? [credencial.toLowerCase()] : []),
      ...(antecedentes && !tiene.conducta ? ["el certificado de buena conducta"] : []),
    ];
    if (faltan.length > 0 && !window.confirm(`En la plataforma no figura: ${faltan.join(", ")}. ¿Verificar a ${nombre} igual?`)) return;
    ejecutar(() => verificarDocente(docenteId, { identidad, titulo, antecedentes }), `${nombre} quedó verificado/a`);
  };

  const conMotivo = (
    accion: (id: string, entrada: { motivo: string }) => ReturnType<typeof verificarDocente>,
    exito: string,
    confirmar?: string,
  ) => {
    setErrorRevision(null);
    if (motivo.trim().length < MIN_MOTIVO) {
      setErrorMotivo("Escribí el motivo: se lo mostramos al docente (mínimo 5 caracteres).");
      document.getElementById(idMotivo)?.focus();
      return;
    }
    setErrorMotivo(null);
    if (confirmar && !window.confirm(confirmar)) return;
    ejecutar(() => accion(docenteId, { motivo }), exito, () => setMotivo(""));
  };

  return (
    <div className="border-t border-borde bg-superficie px-[22px] py-5" aria-busy={pendiente}>
      <EtiquetaSeccion>Revisión</EtiquetaSeccion>
      <fieldset className="m-0 mb-4 flex min-w-0 flex-wrap gap-x-6 gap-y-2.5 border-0 p-0">
        <legend className="sr-only">Qué revisaste</legend>
        <Casilla checked={identidad} onChange={(e) => setIdentidad(e.target.checked)}>
          Revisé el DNI (identidad)
        </Casilla>
        <Casilla checked={titulo} disabled={credencialNoAplica} onChange={(e) => setTitulo(e.target.checked)}>
          Revisé {credencial.toLowerCase()}
          {credencialNoAplica && <span className="text-sutil"> (todavía estudia)</span>}
        </Casilla>
        <Casilla checked={antecedentes} onChange={(e) => setAntecedentes(e.target.checked)}>
          Revisé el certificado de buena conducta
        </Casilla>
      </fieldset>
      {errorRevision && (
        <p role="alert" className="m-0 mb-3 text-xs text-[#b91c1c]">
          {errorRevision}
        </p>
      )}

      <Campo
        etiqueta="Motivo (obligatorio para pedir corrección o rechazar; lo ve el docente)"
        error={errorMotivo ?? undefined}
        className="mb-4 max-w-[640px]"
      >
        <Textarea
          id={idMotivo}
          value={motivo}
          maxLength={500}
          rows={2}
          aria-invalid={errorMotivo ? true : undefined}
          placeholder="Ej.: La foto del DNI está cortada; subila de nuevo con los cuatro bordes visibles."
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Campo>

      <div className="flex flex-wrap gap-2.5">
        <Boton variante="primario" disabled={pendiente} onClick={verificar}>
          Verificar
        </Boton>
        <Boton
          variante="secundario"
          disabled={pendiente}
          onClick={() => conMotivo(pedirCorreccion, "Pedimos la corrección y se lo avisamos")}
        >
          Pedir corrección
        </Boton>
        <Boton
          variante="secundario"
          disabled={pendiente}
          className="border-[#dc2626]/40 text-[#b91c1c] hover:border-[#dc2626] hover:bg-[#fef2f2]"
          onClick={() =>
            conMotivo(
              rechazarDocente,
              "Verificación rechazada y aviso enviado",
              `¿Rechazar la verificación de ${nombre}? Se le avisa con el motivo.`,
            )
          }
        >
          Rechazar
        </Boton>
      </div>
    </div>
  );
}
