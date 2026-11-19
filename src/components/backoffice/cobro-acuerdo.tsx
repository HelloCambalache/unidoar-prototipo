"use client";

import { useState, useTransition } from "react";
import { guardarAcuerdoDePrecio, quitarAcuerdoDePrecio } from "@/app/actions/backoffice-acuerdos";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Input, Select, Textarea } from "@/components/ui/campos";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { ETIQUETA_DE_MODALIDAD, MODALIDADES_DE_ACUERDO, textoDeFin, type ModalidadDeAcuerdo } from "@/lib/acuerdos";
import { etiquetaPeriodo, sumarMeses } from "@/lib/cobros";
import {
  esPlanDebitable,
  MONTO_MINIMO_DE_DEBITO,
  montoBajoParaDebito,
  textoDeMontoBajoParaElEquipo,
  TEXTO_SIN_CARGO_CON_DEBITO,
} from "@/lib/debito-automatico";
import { crearPlanes, pesos, type AcuerdoDePrecio, type CatalogoDePlanes, type PlanClave } from "@/lib/planes";

/** Solo los dígitos de lo que se escribió: el monto es un número entero de pesos. */
const soloDigitos = (texto: string) => texto.replace(/\D/g, "");

/** Cuántos meses hacia adelante se ofrecen para terminar un precio acordado (dos años: alcanza para un período de prueba o una promoción). */
const MESES_PARA_ELEGIR = 24;

/**
 * «Precio acordado» de una institución: un abono propio (cualquier monto desde 0 hasta el de lista), un convenio a medida (un monto fijo por mes, de
 * cualquier valor: para redes o para lo que se acuerde) o sin cargo ($0: una cortesía o un período de prueba). Puede terminar en un mes elegido: pasado
 * ese mes vuelve el precio de lista, sin que nadie tenga que acordarse. Muestra lo que pagaría con sus sedes y vuelve al precio de lista cuando se
 * quiere. El servidor vuelve a validar todo: acá se avisa antes de guardar.
 */
export function CobroAcuerdo({
  institucionId,
  catalogo,
  plan,
  sedes,
  acuerdo,
  vencido,
  nota,
  debitoVigente,
  mesActual,
}: {
  institucionId: string;
  /** Los planes vigentes (los lee el servidor de la base). */
  catalogo: CatalogoDePlanes;
  plan: PlanClave;
  /** Cuántas sedes tiene (para mostrar lo que pagaría). */
  sedes: number;
  /** El acuerdo que rige hoy, o null si paga el de lista. */
  acuerdo: AcuerdoDePrecio | null;
  /** El que tenía y ya terminó (su fecha de fin pasó): solo para avisar; ya paga el de lista. */
  vencido: AcuerdoDePrecio | null;
  /** La nota interna del acuerdo que tiene hoy. */
  nota: string | null;
  /** Tiene un débito automático vivo (pendiente, activo o en pausa): Mercado Pago no le deja bajar el monto por debajo de su mínimo. */
  debitoVigente: boolean;
  /** El mes en curso en Argentina ("2026-11"): desde ahí se eligen los meses en que puede terminar el acuerdo. */
  mesActual: string;
}) {
  const P = crearPlanes(catalogo);
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [modalidad, setModalidad] = useState<ModalidadDeAcuerdo>(acuerdo?.modalidad ?? "abono");
  const [sinCargo, setSinCargo] = useState(acuerdo?.monto === 0);
  const [monto, setMonto] = useState(acuerdo && acuerdo.monto > 0 ? String(acuerdo.monto) : "");
  const [hasta, setHasta] = useState(acuerdo?.hasta ?? "");
  const [texto, setTexto] = useState(nota ?? "");
  const [errores, setErrores] = useState<Record<string, string>>({});

  const abrir = () => {
    setModalidad(acuerdo?.modalidad ?? "abono");
    setSinCargo(acuerdo?.monto === 0);
    setMonto(acuerdo && acuerdo.monto > 0 ? String(acuerdo.monto) : "");
    setHasta(acuerdo?.hasta ?? "");
    setTexto(nota ?? "");
    setErrores({});
    setAbierto(true);
  };

  const { maximo } = P.rangoDeAbono(plan);
  const puedeQuedarSinCargo = !P.esPuntual(plan);
  // Sin cargo es un convenio en cero (no depende de las sedes): lo que se arma es siempre un monto fijo de $0.
  const modalidadElegida: ModalidadDeAcuerdo = sinCargo ? "total" : modalidad;
  const montoNumero = sinCargo ? 0 : monto !== "" ? Number(monto) : null;
  const propuesto: AcuerdoDePrecio | null = montoNumero === null ? null : { modalidad: modalidadElegida, monto: montoNumero, ...(hasta ? { hasta } : {}) };
  const errorPrevio = propuesto ? P.errorDeAcuerdo(plan, propuesto) : null;
  // Lo que pagaría por mes con este acuerdo. Por debajo del mínimo de una suscripción de Mercado Pago no se puede activar el débito automático:
  // se avisa antes de guardar y no se impide (un precio chico sirve, por ejemplo, para probar un pago con poca plata).
  const montoConElAcuerdo = propuesto && !errorPrevio ? P.montoDePlan(plan, sedes, propuesto) : null;
  const quedaSinCargo = montoConElAcuerdo === 0;
  const sinDebitoPorMonto = esPlanDebitable(plan) && montoBajoParaDebito(montoConElAcuerdo);
  // El precio al que vuelve cuando termina el acuerdo: el de lista de su plan (con sus sedes), o «a convenir» si es una red sin convenio.
  const precioDespues = P.precioDefinido(plan, null) ? `${pesos(P.montoDePlan(plan, sedes))} por mes` : "a convenir (no se factura hasta cargar un convenio)";

  // Los meses en que puede terminar: del actual a dos años. Si ya tiene uno más lejano, se conserva para no perderlo al abrir.
  const opcionesDeFin = Array.from({ length: MESES_PARA_ELEGIR }, (_, k) => sumarMeses(mesActual, k));
  if (hasta && !opcionesDeFin.includes(hasta)) opcionesDeFin.push(hasta);

  const guardar = () => {
    if (!propuesto) {
      setErrores({ monto: "Escribí el monto en pesos (0 si no paga nada)." });
      return;
    }
    setErrores({});
    empezar(async () => {
      try {
        const r = await guardarAcuerdoDePrecio(institucionId, { modalidad: modalidadElegida, monto: propuesto.monto, hasta, nota: texto });
        if (!r.ok) {
          setErrores(r.campos ?? { _: r.error });
          toast(r.error, "error");
          return;
        }
        if (!r.data.cambio) {
          toast("No había nada para cambiar");
        } else if (quedaSinCargo) {
          toast(
            `Guardado: la institución no paga nada${hasta ? ` ${textoDeFin(hasta)}` : ""}. No se le generan facturas${hasta ? " y después vuelve el precio de lista" : ""}.`,
          );
        } else {
          toast(
            `Precio acordado guardado: rige desde la próxima factura${hasta ? ` y ${textoDeFin(hasta)}` : ""}${sinDebitoPorMonto ? `. Ojo: con ese monto no se puede activar el débito automático (Mercado Pago pide al menos ${pesos(MONTO_MINIMO_DE_DEBITO)} por mes).` : ""}`,
          );
        }
        setAbierto(false);
      } catch {
        toast("No pudimos guardar el precio. Probá de nuevo.", "error");
      }
    });
  };

  const volverALista = async () => {
    const ok = await pedirConfirmacion(
      `¿Volver al precio de lista (${pesos(P.abonoDe(plan))})? Rige desde la próxima factura; las ya emitidas no cambian.`,
    );
    if (!ok) return;
    empezar(async () => {
      try {
        const r = await quitarAcuerdoDePrecio(institucionId);
        if (!r.ok) {
          toast(r.error, "error");
          return;
        }
        toast("Vuelve al precio de lista desde la próxima factura");
        setAbierto(false);
      } catch {
        toast("No pudimos volver al precio de lista. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <>
      <Boton variante="secundario" bloque onClick={abrir}>
        {acuerdo ? "Cambiar el precio acordado" : "Acordar un precio"}
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Precio acordado">
        <p className="m-0 mb-4 text-sm leading-normal text-apagado">
          Cada plan tiene un precio de lista ({pesos(maximo)} por mes en este caso). Acá fijás el que acordaste con esta institución: un abono propio, un monto
          fijo de cualquier valor o que no pague nada. Si le ponés un fin, pasado ese mes vuelve solo el precio de lista. Rige desde la próxima factura: las
          ya emitidas no cambian y el débito automático se pone al día solo.
        </p>
        {vencido && !acuerdo && (
          <p role="status" className="m-0 mb-4 rounded-caja bg-superficie px-3.5 py-2.5 text-[13px] leading-normal text-tinta-2">
            Tenía un precio acordado ({vencido.monto === 0 ? "sin cargo" : pesos(vencido.monto) + " por mes"}) que terminó en {etiquetaPeriodo(vencido.hasta ?? mesActual).toLowerCase()}:
            desde entonces paga el de lista.
          </p>
        )}
        <div className="mb-4 grid grid-cols-1 gap-3">
          {puedeQuedarSinCargo && (
            <Casilla checked={sinCargo} onChange={(e) => setSinCargo(e.target.checked)} className="rounded-caja bg-superficie px-3.5 py-3">
              <b className="font-semibold text-tinta">Sin cargo</b>: la institución no paga nada (una cortesía, o un período de prueba o promoción si le ponés un fin). No se le genera
              ninguna factura.
            </Casilla>
          )}
          {!sinCargo && (
            <>
              <Campo etiqueta="Tipo de precio" requerido error={errores.modalidad}>
                <Select value={modalidad} onChange={(e) => setModalidad(e.target.value as ModalidadDeAcuerdo)}>
                  {MODALIDADES_DE_ACUERDO.map((m) => (
                    <option key={m} value={m}>
                      {ETIQUETA_DE_MODALIDAD[m]}
                      {m === "abono" ? " (hasta el precio de lista, por sede)" : " (monto fijo por mes, de cualquier valor)"}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo
                etiqueta={modalidad === "abono" ? "Abono por mes ($)" : "Monto total por mes ($)"}
                requerido
                error={errores.monto ?? intentoDeError(errorPrevio, monto)}
                ayuda={
                  modalidad === "abono"
                    ? `Hasta ${pesos(maximo)} (el precio de lista). Las sedes adicionales siguen con su descuento sobre este abono. Para un monto mayor, usá un convenio a medida.`
                    : "Es lo que paga por mes en total, sin importar cuántas sedes tenga. Puede ser cualquier valor."
                }
              >
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  value={monto}
                  maxLength={8}
                  onChange={(e) => setMonto(soloDigitos(e.target.value))}
                  aria-invalid={!!(errores.monto ?? intentoDeError(errorPrevio, monto)) || undefined}
                />
              </Campo>
            </>
          )}
          <Campo
            etiqueta="Rige hasta"
            error={errores.hasta}
            ayuda={hasta ? `Después de ${etiquetaPeriodo(hasta).toLowerCase()} se factura el precio de lista: ${precioDespues}.` : "Sin fecha de fin: rige hasta que lo cambies."}
          >
            <Select value={hasta} onChange={(e) => setHasta(e.target.value)} aria-invalid={!!errores.hasta || undefined}>
              <option value="">Sin fecha de fin</option>
              {opcionesDeFin.map((p) => (
                <option key={p} value={p}>
                  {etiquetaPeriodo(p)} (último mes)
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Nota" error={errores.nota} ayuda="Interna, la institución no la ve. Por ejemplo, qué se acordó y con quién.">
            <Textarea rows={2} value={texto} maxLength={200} onChange={(e) => setTexto(e.target.value)} aria-invalid={!!errores.nota || undefined} />
          </Campo>
        </div>
        {propuesto && !errorPrevio && (
          <p className="m-0 mb-4 rounded-caja bg-superficie px-3.5 py-2.5 text-[13px] leading-normal text-tinta-2">
            {quedaSinCargo ? (
              <>
                La institución <b className="font-semibold text-tinta">no pagaría nada</b>
                {hasta ? ` ${textoDeFin(hasta)}` : ""}: no se le generan facturas ni mails de cobro y su plan queda activo sin un primer pago.
                {hasta ? ` Después, ${precioDespues}.` : ""}
              </>
            ) : (
              <>
                Con {sedes} {sedes === 1 ? "sede" : "sedes"} pagaría <b className="font-semibold text-tinta">{pesos(P.montoDePlan(plan, sedes, propuesto))}</b> por mes
                {hasta ? ` ${textoDeFin(hasta)}` : ""}
                {propuesto.modalidad === "abono" && sedes === 1 ? ` (el de lista es ${pesos(P.montoDePlan(plan, 1))})` : ""}.
                {hasta ? ` Después, ${precioDespues}.` : ""}
              </>
            )}
          </p>
        )}
        {quedaSinCargo && debitoVigente && (
          <p role="status" className="m-0 mb-4 rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
            {TEXTO_SIN_CARGO_CON_DEBITO}
          </p>
        )}
        {sinDebitoPorMonto && montoConElAcuerdo !== null && (
          <p role="status" className="m-0 mb-4 rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
            {textoDeMontoBajoParaElEquipo(montoConElAcuerdo, debitoVigente)}
          </p>
        )}
        {errores._ && (
          <p role="alert" className="m-0 mb-3 text-xs text-[#b91c1c]">
            {errores._}
          </p>
        )}
        <div className="flex flex-wrap gap-2.5">
          <Boton disabled={pendiente || !propuesto || !!errorPrevio} onClick={guardar}>
            {pendiente ? "Guardando…" : "Guardar precio"}
          </Boton>
          {(acuerdo || vencido) && (
            <Boton variante="secundario" disabled={pendiente} onClick={volverALista}>
              Volver al precio de lista
            </Boton>
          )}
          <Boton variante="fantasma" disabled={pendiente} onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}

/** El error de rango solo se muestra cuando ya se escribió algo: con el campo vacío no se grita. */
const intentoDeError = (error: string | null, monto: string) => (monto ? (error ?? undefined) : undefined);
