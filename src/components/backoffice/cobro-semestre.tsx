"use client";

import { useState, useTransition } from "react";
import { registrarSemestreAlContado } from "@/app/actions/backoffice-cobros";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Input, Select } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { avisoDeCobroEnMesBonificado } from "@/lib/bonificacion";
import {
  conflictosDeSemestre,
  DIAS_MAXIMOS_PAGO_ATRASADO,
  errorDeFechaDePago,
  errorDeInicioDeSemestre,
  etiquetaDeCobertura,
  etiquetaPeriodo,
  hoyAR,
  MEDIOS_SEMESTRE,
  periodoActual,
  sumarMeses,
} from "@/lib/cobros";
import { crearPlanes, pesos, type AcuerdoDePrecio, type CatalogoDePlanes, type PlanClave } from "@/lib/planes";

const PERIODO_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Lo mínimo de cada factura de la institución que hace falta para saber si el semestre se puede registrar desde el mes elegido. */
export type FacturaDelSemestre = { periodo: string; estado: string; mesesCubiertos: number };

/**
 * "Registrar semestre al contado": la institución pagó por adelantado los meses del pack (pagás 5, usás 6), en efectivo o por transferencia.
 * Queda una factura paga que cubre todos los meses; el monto lo calcula el servidor (acá se muestra para ver qué va a pasar). Si tiene un
 * débito automático vivo, se cancela junto con el registro.
 */
export function CobroSemestre({
  institucionId,
  sedes,
  acuerdo = null,
  catalogo,
  plan,
  periodoSugerido,
  facturas,
  debitoVigente,
  periodosBonificados = [],
}: {
  institucionId: string;
  /** Cuántas sedes tiene (el semestre es el monto mensual, con sus sedes adicionales, por los meses que se pagan). */
  sedes: number;
  /** El precio acordado con la institución: el semestre se calcula con él. */
  acuerdo?: AcuerdoDePrecio | null;
  /** Los planes vigentes (los lee el servidor de la base). */
  catalogo: CatalogoDePlanes;
  plan: PlanClave;
  /** Mes que se propone para que empiece ("2026-11"). */
  periodoSugerido: string;
  facturas: FacturaDelSemestre[];
  /** Tiene un débito automático vivo: se ofrece cancelarlo junto con el registro. */
  debitoVigente: boolean;
  /** Los meses que esta institución ya tiene bonificados por recomendar (no se facturaron: no los paga). Un semestre que los cubre exige confirmarlo. */
  periodosBonificados?: string[];
}) {
  const P = crearPlanes(catalogo);
  const { meses, mesesQueSePagan } = P.condiciones.pack;
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [periodo, setPeriodo] = useState(periodoSugerido);
  const [medio, setMedio] = useState<(typeof MEDIOS_SEMESTRE)[number]>("Transferencia");
  const [fecha, setFecha] = useState(() => hoyAR());
  const [nota, setNota] = useState("");
  const [avisar, setAvisar] = useState(true);
  const [cancelarDebito, setCancelarDebito] = useState(debitoVigente);
  const [registrarIgual, setRegistrarIgual] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const abrir = () => {
    setPeriodo(periodoSugerido);
    setMedio("Transferencia");
    setFecha(hoyAR());
    setNota("");
    setAvisar(true);
    setCancelarDebito(debitoVigente);
    setRegistrarIgual(false);
    setErrores({});
    setAbierto(true);
  };

  const mensual = P.montoDePlan(plan, sedes, acuerdo);
  const total = mensual * mesesQueSePagan;
  const bonificado = mensual * (meses - mesesQueSePagan);

  const valido = PERIODO_VALIDO.test(periodo);
  // Si alguno de los meses que cubre el semestre es un mes bonificado por recomendar (no se paga), hay que confirmarlo.
  const ventana = valido ? Array.from({ length: meses }, (_, k) => sumarMeses(periodo, k)) : [];
  const bonificadosEnLaVentana = periodosBonificados.filter((p) => ventana.includes(p));
  const { pagos, impagas } = valido ? conflictosDeSemestre(periodo, meses, facturas) : { pagos: [], impagas: [] };
  const errorInicio = valido ? errorDeInicioDeSemestre(periodo, periodoActual()) : null;
  const sePuede = valido && pagos.length === 0 && impagas.length === 0 && !errorInicio;
  const convierte = valido && facturas.some((f) => f.periodo === periodo && f.estado !== "pagada");
  const lista = (ps: string[]) => ps.map(etiquetaPeriodo).join(", ");

  const aviso = !valido
    ? null
    : errorInicio
      ? { clase: "bg-[#F6E6E0] text-[#8F3D28]", texto: errorInicio }
      : pagos.length > 0
        ? { clase: "bg-[#F6E6E0] text-[#8F3D28]", texto: `${lista(pagos)} ya figura${pagos.length === 1 ? "" : "n"} como pago. Elegí otro mes de inicio.` }
        : impagas.length > 0
          ? { clase: "bg-[#F6E6E0] text-[#8F3D28]", texto: `Hay facturas sin pagar dentro de esos meses (${lista(impagas)}): registrales el pago o elegí otro mes.` }
          : {
              clase: "bg-superficie text-tinta-2",
              texto: `Cubre ${etiquetaDeCobertura(periodo, meses)}. Paga ${pesos(total)} (${mesesQueSePagan} meses de ${pesos(mensual)}): se bonifica ${bonificado > 0 ? pesos(bonificado) : "nada"}. ${
                convierte ? `La factura de ${etiquetaPeriodo(periodo)}, que está sin pagar, pasa a ser la del semestre.` : "Se crea una sola factura, ya paga."
              }`,
            };

  const guardar = () => {
    const falloFecha = fecha ? errorDeFechaDePago(fecha, hoyAR()) : "Elegí la fecha del pago.";
    if (falloFecha) {
      setErrores({ fecha: falloFecha });
      return;
    }
    setErrores({});
    empezar(async () => {
      try {
        const r = await registrarSemestreAlContado(institucionId, {
          periodo,
          medio,
          fecha,
          nota,
          avisar,
          cancelarDebito: debitoVigente && cancelarDebito,
          cobrarMesesBonificados: bonificadosEnLaVentana.length > 0 && registrarIgual,
        });
        if (!r.ok) {
          setErrores(r.campos ?? { _: r.error });
          toast(r.error, "error");
          return;
        }
        toast(`Semestre registrado: cubre ${etiquetaDeCobertura(periodo, meses)}`);
        setAbierto(false);
      } catch {
        toast("No pudimos registrar el pago. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <>
      <Boton variante="secundario" bloque onClick={abrir}>
        Registrar semestre al contado
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Registrar un semestre al contado">
        <p className="m-0 mb-4 text-sm leading-normal text-apagado">
          Para cuando la institución pagó {meses} meses por adelantado, en efectivo o por transferencia: paga {mesesQueSePagan} y usa {meses}. No hace falta cargar
          antes la factura.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
          <Campo etiqueta="Mes en que empieza" requerido error={errores.periodo}>
            <Input
              type="month"
              value={periodo}
              pattern="\d{4}-\d{2}"
              placeholder="2026-11"
              onChange={(e) => setPeriodo(e.target.value)}
              aria-invalid={!!errores.periodo || undefined}
            />
          </Campo>
          <Campo etiqueta="Fecha del pago" requerido error={errores.fecha} ayuda="Por defecto, hoy. Cambiala si lo recibiste antes.">
            <Input
              type="date"
              value={fecha}
              max={hoyAR()}
              min={new Date(Date.parse(`${hoyAR()}T00:00:00Z`) - DIAS_MAXIMOS_PAGO_ATRASADO * 86_400_000)
                .toISOString()
                .slice(0, 10)}
              onChange={(e) => setFecha(e.target.value)}
              aria-invalid={!!errores.fecha || undefined}
            />
          </Campo>
          <Campo etiqueta="Cómo pagó" requerido error={errores.medio}>
            <Select value={medio} onChange={(e) => setMedio(e.target.value as (typeof MEDIOS_SEMESTRE)[number])}>
              {MEDIOS_SEMESTRE.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Nota" error={errores.nota} ayuda="Optativa. Por ejemplo, el número de recibo.">
            <Input value={nota} maxLength={120} onChange={(e) => setNota(e.target.value)} aria-invalid={!!errores.nota || undefined} />
          </Campo>
        </div>
        {aviso && <p className={`m-0 mb-4 rounded-caja px-3.5 py-2.5 text-[13px] leading-normal ${aviso.clase}`}>{aviso.texto}</p>}
        {bonificadosEnLaVentana.length > 0 && (
          <div className="mb-4 rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
            <p className="m-0 mb-2">{avisoDeCobroEnMesBonificado(bonificadosEnLaVentana.map(etiquetaPeriodo), "semestre")}</p>
            <Casilla checked={registrarIgual} onChange={(e) => setRegistrarIgual(e.target.checked)}>
              Registrar igual ({bonificadosEnLaVentana.length === 1 ? "el mes bonificado vuelve a quedar disponible" : "los meses bonificados vuelven a quedar disponibles"})
            </Casilla>
          </div>
        )}
        <div className="mb-4 flex flex-col gap-2.5">
          <Casilla checked={avisar} onChange={(e) => setAvisar(e.target.checked)}>
            Avisarle a la institución que registramos su pago
          </Casilla>
          {debitoVigente && (
            <Casilla checked={cancelarDebito} onChange={(e) => setCancelarDebito(e.target.checked)}>
              Cancelar también el débito automático (tiene uno activo y le cobraría meses que ya pagó)
            </Casilla>
          )}
        </div>
        {(errores.cancelarDebito || errores._) && (
          <p role="alert" className="m-0 mb-3 text-xs text-[#b91c1c]">
            {errores.cancelarDebito ?? errores._}
          </p>
        )}
        <div className="flex gap-2.5">
          <Boton disabled={pendiente || !sePuede || (bonificadosEnLaVentana.length > 0 && !registrarIgual)} onClick={guardar}>
            {pendiente ? "Registrando…" : "Registrar semestre"}
          </Boton>
          <Boton variante="secundario" disabled={pendiente} onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
