"use client";

import { useState, useTransition } from "react";
import { guardarAcuerdoDePrecio, quitarAcuerdoDePrecio } from "@/app/actions/backoffice-acuerdos";
import { Boton } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { ETIQUETA_DE_MODALIDAD, MODALIDADES_DE_ACUERDO, type ModalidadDeAcuerdo } from "@/lib/acuerdos";
import { crearPlanes, pesos, type AcuerdoDePrecio, type CatalogoDePlanes, type PlanClave } from "@/lib/planes";

/** Solo los dígitos de lo que se escribió: el monto es un número entero de pesos. */
const soloDigitos = (texto: string) => texto.replace(/\D/g, "");

/**
 * «Precio acordado» de una institución: un abono propio dentro del rango del plan (entre el piso y la lista) o un convenio a medida (un monto
 * fijo por mes, para redes). Muestra el rango, lo que pagaría con sus sedes y vuelve al precio de lista cuando se quiere. El servidor vuelve a
 * validar todo: acá se avisa antes de guardar.
 */
export function CobroAcuerdo({
  institucionId,
  catalogo,
  plan,
  sedes,
  acuerdo,
  nota,
}: {
  institucionId: string;
  /** Los planes vigentes (los lee el servidor de la base). */
  catalogo: CatalogoDePlanes;
  plan: PlanClave;
  /** Cuántas sedes tiene (para mostrar lo que pagaría). */
  sedes: number;
  /** El acuerdo que tiene hoy, o null si paga el de lista. */
  acuerdo: AcuerdoDePrecio | null;
  /** La nota interna del acuerdo que tiene hoy. */
  nota: string | null;
}) {
  const P = crearPlanes(catalogo);
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [modalidad, setModalidad] = useState<ModalidadDeAcuerdo>(acuerdo?.modalidad ?? "abono");
  const [monto, setMonto] = useState(acuerdo ? String(acuerdo.monto) : "");
  const [texto, setTexto] = useState(nota ?? "");
  const [errores, setErrores] = useState<Record<string, string>>({});

  const abrir = () => {
    setModalidad(acuerdo?.modalidad ?? "abono");
    setMonto(acuerdo ? String(acuerdo.monto) : "");
    setTexto(nota ?? "");
    setErrores({});
    setAbierto(true);
  };

  const { minimo, maximo } = P.rangoDeAbono(plan);
  const hayRango = minimo < maximo;
  const montoNumero = monto ? Number(monto) : null;
  const propuesto: AcuerdoDePrecio | null = montoNumero ? { modalidad, monto: montoNumero } : null;
  const errorPrevio = propuesto ? P.errorDeAcuerdo(plan, propuesto) : null;

  const guardar = () => {
    if (!propuesto) {
      setErrores({ monto: "Escribí el monto en pesos." });
      return;
    }
    setErrores({});
    empezar(async () => {
      try {
        const r = await guardarAcuerdoDePrecio(institucionId, { modalidad, monto: propuesto.monto, nota: texto });
        if (!r.ok) {
          setErrores(r.campos ?? { _: r.error });
          toast(r.error, "error");
          return;
        }
        toast(r.data.cambio ? "Precio acordado guardado: rige desde la próxima factura" : "No había nada para cambiar");
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
          Cada plan tiene un precio de lista ({pesos(maximo)} por mes en este caso). Acá fijás el que acordaste con esta institución. Rige desde la próxima
          factura: las ya emitidas no cambian y el débito automático se pone al día solo.
        </p>
        <div className="mb-4 grid grid-cols-1 gap-3">
          <Campo etiqueta="Tipo de precio" requerido error={errores.modalidad}>
            <Select value={modalidad} onChange={(e) => setModalidad(e.target.value as ModalidadDeAcuerdo)}>
              {MODALIDADES_DE_ACUERDO.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_DE_MODALIDAD[m]}
                  {m === "abono" ? " (dentro del rango del plan)" : " (monto fijo por mes, para redes)"}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo
            etiqueta={modalidad === "abono" ? "Abono por mes ($)" : "Monto total por mes ($)"}
            requerido
            error={errores.monto ?? (intentoDeError(errorPrevio, monto))}
            ayuda={
              modalidad === "abono"
                ? hayRango
                  ? `Entre ${pesos(minimo)} (el piso) y ${pesos(maximo)} (la lista). Las sedes adicionales siguen con su descuento sobre este abono.`
                  : `Este plan no tiene piso: el abono es el de lista. Cargá un precio mínimo en Planes para poder acordar un abono, o usá un convenio a medida.`
                : "Es lo que paga por mes en total, sin importar cuántas sedes tenga. No tiene límite de rango."
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
          <Campo etiqueta="Nota" error={errores.nota} ayuda="Interna, la institución no la ve. Por ejemplo, qué se acordó y con quién.">
            <Textarea rows={2} value={texto} maxLength={200} onChange={(e) => setTexto(e.target.value)} aria-invalid={!!errores.nota || undefined} />
          </Campo>
        </div>
        {propuesto && !errorPrevio && (
          <p className="m-0 mb-4 rounded-caja bg-superficie px-3.5 py-2.5 text-[13px] leading-normal text-tinta-2">
            Con {sedes} {sedes === 1 ? "sede" : "sedes"} pagaría <b className="font-semibold text-tinta">{pesos(P.montoDePlan(plan, sedes, propuesto))}</b> por mes
            {propuesto.modalidad === "abono" && sedes === 1 ? ` (el de lista es ${pesos(P.montoDePlan(plan, 1))})` : ""}.
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
          {acuerdo && (
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
