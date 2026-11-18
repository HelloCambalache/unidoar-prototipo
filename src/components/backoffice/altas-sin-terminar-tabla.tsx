"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { enviarRecordatoriosDeAlta, reenviarConfirmacionesDeAlta, type ResultadoDeAvisos } from "@/app/actions/backoffice-cuentas";
import { CuentaSinTerminarBorrar } from "@/components/backoffice/cuenta-sin-terminar-borrar";
import { Boton } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { useToast } from "@/components/ui/toast";
import { MAX_AVISOS_POR_PERSONA, MAX_CONFIRMACIONES_POR_ENVIO, MAX_RECORDATORIOS_POR_ENVIO, type TipoDeAviso } from "@/lib/cuentas-sin-terminar";

/** Lo que la tabla necesita de cada cuenta, ya armado por el servidor (todo serializable: las fechas ya vienen como texto). */
export type FilaDeAltaSinTerminar = {
  id: string;
  email: string;
  rol: "docente" | "institucion" | null;
  fecha: string;
  haceTiempo: string;
  etapa: string;
  perfilEmpezado: boolean;
  /** Qué se le manda: la confirmación del mail (si nunca la confirmó) o un recordatorio. */
  tipoDeAviso: TipoDeAviso;
  /** Cuántos avisos recibió y cuándo, ya redactado. */
  avisos: string;
  /** Por qué no se le puede avisar ahora (null = se puede). */
  motivoNo: string | null;
};

const ROL = { docente: "Profesional", institucion: "Institución" } as const;
const MAXIMO: Record<TipoDeAviso, number> = { recordatorio: MAX_RECORDATORIOS_POR_ENVIO, confirmacion: MAX_CONFIRMACIONES_POR_ENVIO };

const personas = (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`;

/** Lo que se le dice al equipo después de mandar: a cuántas salió y, si hubo, por qué otras no o dónde se cortó. */
function resumenDelEnvio(r: ResultadoDeAvisos): string {
  const partes = [r.enviados === 0 ? "No se mandó ninguno" : `Se mandó a ${personas(r.enviados)}`];
  if (r.rechazadas > 0 && r.motivos.length > 0) partes.push(`${r.rechazadas} no correspondían: ${r.motivos.join(" ")}`);
  if (r.corte) partes.push(`Se cortó el envío: ${r.corte}`);
  return partes.join(". ") + ".";
}

/**
 * La lista de «Altas sin terminar» con casillas: el equipo elige cuentas y les manda un aviso para que terminen el registro. A quien nunca
 * confirmó el mail se le reenvía el mail de confirmación; al resto, un recordatorio. El servidor vuelve a leer las cuentas y a aplicar los topes
 * (dos avisos por persona, una semana entre uno y otro, un máximo por clic y por día): esta pantalla solo ayuda a elegir bien.
 */
export function AltasSinTerminarTabla({ filas }: { filas: FilaDeAltaSinTerminar[] }) {
  const router = useRouter();
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());

  const porId = useMemo(() => new Map(filas.map((f) => [f.id, f])), [filas]);
  const elegibles = useMemo(() => filas.filter((f) => f.motivoNo === null), [filas]);
  const cuantas = (tipo: TipoDeAviso) => [...elegidas].filter((id) => porId.get(id)?.tipoDeAviso === tipo).length;
  const recordatorios = cuantas("recordatorio");
  const confirmaciones = cuantas("confirmacion");

  const alternar = (fila: FilaDeAltaSinTerminar) =>
    setElegidas((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(fila.id)) nuevas.delete(fila.id);
      else if (cuantas(fila.tipoDeAviso) < MAXIMO[fila.tipoDeAviso]) nuevas.add(fila.id);
      return nuevas;
    });

  // «Elegir todas» toma las que se pueden, hasta el máximo de cada tipo por clic.
  const todasElegidas = elegibles.length > 0 && elegibles.every((f) => elegidas.has(f.id));
  const alternarTodas = () =>
    setElegidas(() => {
      if (todasElegidas || elegidas.size > 0) return new Set();
      const nuevas = new Set<string>();
      const usadas: Record<TipoDeAviso, number> = { recordatorio: 0, confirmacion: 0 };
      for (const f of elegibles) {
        if (usadas[f.tipoDeAviso] >= MAXIMO[f.tipoDeAviso]) continue;
        usadas[f.tipoDeAviso] += 1;
        nuevas.add(f.id);
      }
      return nuevas;
    });

  const mandar = async (tipo: TipoDeAviso) => {
    const ids = [...elegidas].filter((id) => porId.get(id)?.tipoDeAviso === tipo);
    if (ids.length === 0) return;
    const mensaje =
      tipo === "recordatorio"
        ? `¿Mandar un recordatorio a ${personas(ids.length)}? Les llega un mail para que terminen su registro. A cada persona le escribimos como mucho ${MAX_AVISOS_POR_PERSONA} veces, con una semana entre una y otra.`
        : `¿Reenviar el mail de confirmación a ${personas(ids.length)}? Es el mismo mail de siempre, con el botón para confirmar su cuenta. Cuenta como un aviso: como mucho ${MAX_AVISOS_POR_PERSONA} por persona.`;
    if (!(await pedirConfirmacion(mensaje))) return;
    empezar(async () => {
      try {
        const r = tipo === "recordatorio" ? await enviarRecordatoriosDeAlta(ids) : await reenviarConfirmacionesDeAlta(ids);
        if (!r.ok) {
          toast(r.error, "error");
          return;
        }
        toast(resumenDelEnvio(r.data), r.data.enviados === 0 || r.data.corte ? "error" : undefined);
        setElegidas(new Set());
        router.refresh();
      } catch {
        toast("No pudimos completar el envío. Recargá la lista antes de reintentar: puede que ya haya salido.", "error");
      }
    });
  };

  const hayRecordatorios = filas.some((f) => f.tipoDeAviso === "recordatorio");
  const hayConfirmaciones = filas.some((f) => f.tipoDeAviso === "confirmacion");

  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        {hayRecordatorios && (
          <Boton variante="primario" tamano="sm" disabled={pendiente || recordatorios === 0} aria-busy={pendiente} onClick={() => mandar("recordatorio")}>
            Enviar recordatorio{recordatorios > 0 ? ` (${recordatorios})` : ""}
          </Boton>
        )}
        {hayConfirmaciones && (
          <Boton variante="primario" tamano="sm" disabled={pendiente || confirmaciones === 0} aria-busy={pendiente} onClick={() => mandar("confirmacion")}>
            Reenviar confirmación{confirmaciones > 0 ? ` (${confirmaciones})` : ""}
          </Boton>
        )}
        <span className="text-xs leading-normal text-sutil" role="status">
          {elegidas.size === 0
            ? "Elegí las cuentas con las casillas."
            : `${personas(elegidas.size)} elegida${elegidas.size === 1 ? "" : "s"}.`}
        </span>
      </div>

      <Tabla className="min-w-[820px]">
        <thead>
          <tr>
            <th className="w-10">
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-navy-700 disabled:cursor-not-allowed"
                aria-label="Elegir todas las que se pueden avisar"
                checked={elegidas.size > 0}
                ref={(el) => {
                  // A medias cuando hay algunas elegidas y no todas (por ejemplo, el máximo por vez ya se alcanzó).
                  if (el) el.indeterminate = elegidas.size > 0 && !todasElegidas;
                }}
                disabled={elegibles.length === 0 || pendiente}
                onChange={alternarTodas}
              />
            </th>
            <th>Email</th>
            <th>Quién</th>
            <th>Se registró</th>
            <th>Dónde se quedó</th>
            <th>Avisos</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const llena = !elegidas.has(f.id) && cuantas(f.tipoDeAviso) >= MAXIMO[f.tipoDeAviso];
            return (
              <tr key={f.id}>
                <td>
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-navy-700 disabled:cursor-not-allowed"
                    aria-label={`Elegir a ${f.email}`}
                    title={f.motivoNo ?? (llena ? `Ya elegiste el máximo por vez (${MAXIMO[f.tipoDeAviso]}).` : undefined)}
                    checked={elegidas.has(f.id)}
                    disabled={f.motivoNo !== null || llena || pendiente}
                    onChange={() => alternar(f)}
                  />
                </td>
                <td className="font-semibold [overflow-wrap:anywhere]">{f.email}</td>
                <td>{f.rol ? <Insignia tono="azul">{ROL[f.rol]}</Insignia> : <span className="text-sutil">—</span>}</td>
                <td className="whitespace-nowrap text-apagado">
                  {f.fecha}
                  <span className="block text-xs text-sutil">{f.haceTiempo}</span>
                </td>
                <td className="text-apagado">{f.etapa}</td>
                <td className="text-apagado">
                  {f.avisos}
                  {f.motivoNo && <span className="block max-w-[28ch] text-xs leading-snug text-sutil">{f.motivoNo}</span>}
                </td>
                <td className="text-right">
                  <CuentaSinTerminarBorrar cuentaId={f.id} email={f.email} perfilEmpezado={f.perfilEmpezado} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Tabla>
    </>
  );
}
