"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarPlanes } from "@/app/actions/backoffice-planes";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Input, Textarea } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import { plural } from "@/lib/busquedas";
import { TIPOS_INSTITUCION } from "@/lib/catalogo";
import {
  cambiosDePlanes,
  camposDeErrorDePlanes,
  CLAVES_PLAN,
  describirCambioDePlanes,
  edicionDePlanesSchema,
  huellaDePlanes,
  crearPlanes,
  pesos,
  PLANES_POR_DEFECTO,
  type CatalogoDePlanes,
  type EdicionDePlanes,
  type PlanClave,
} from "@/lib/planes";

/** Lo que dice cada plan sobre quién lo recibe: no se edita, es cómo funciona el sistema. */
const QUIEN_LO_RECIBE: Record<PlanClave, string> = {
  colegio: "Lo reciben las instituciones nuevas cuyo tipo está tildado más abajo, en «Arancel de colegios».",
  deportiva: "Lo reciben las instituciones nuevas de cualquier otro tipo.",
  multisede: "Se asigna a mano desde la ficha de la institución (redes de varias sedes: valor a convenir). El precio es por sede.",
  fundador: "Es el plan de las instituciones fundadoras: el precio queda congelado mientras sigan suscriptas. Ya no se asigna a cuentas nuevas (el arancel sale del tipo de institución).",
  estandar: "Plan anterior: ya no se ofrece, pero lo siguen teniendo las instituciones que lo contrataron.",
  anual: "Plan anterior: ya no se ofrece, pero lo siguen teniendo las instituciones que lo contrataron.",
};

/** Los dos planes que reciben a las instituciones nuevas: no se pueden dejar de ofrecer. */
const SIEMPRE_VIGENTES: readonly PlanClave[] = ["colegio", "deportiva"];

const VIGENTES: readonly PlanClave[] = CLAVES_PLAN.filter((c) => PLANES_POR_DEFECTO[c].vigente);
/** La tarjeta "Fundadoras" de la landing: el plan que tienen las instituciones que entraron primero. */
const FUNDADORAS: readonly PlanClave[] = ["fundador"];
/** Lo que ya no se vende y no tiene tarjeta en la landing (Estándar y Anual): va plegado al final. */
const ANTERIORES: readonly PlanClave[] = CLAVES_PLAN.filter((c) => !PLANES_POR_DEFECTO[c].vigente && !FUNDADORAS.includes(c));

const aNumero = (texto: string) => {
  const n = Number(texto);
  return Number.isFinite(n) ? n : 0;
};

/** Solo los dígitos de lo que se escribió: el precio es un número entero de pesos. */
const soloDigitos = (texto: string) => texto.replace(/\D/g, "");

/**
 * Edición de los planes y aranceles. Todo el estado vive acá; al guardar se muestra un resumen de lo que cambia (y a cuántas
 * instituciones alcanza) y recién ahí se manda al servidor, que vuelve a validar y deja el cambio anotado. Se monta con `key` =
 * la huella de lo guardado, así después de guardar arranca de cero con lo último.
 */
export function PlanesFormulario({
  inicial,
  huella,
  cantidades,
  cupos,
  totalCupos,
}: {
  inicial: EdicionDePlanes;
  /** Huella de lo guardado cuando se abrió la pantalla (`huellaDePlanes`): el servidor no pisa lo que otra persona cambió mientras tanto. */
  huella: string;
  /** Cuántas instituciones tiene hoy cada plan. */
  cantidades: Record<PlanClave, number>;
  /** Cupos de fundadoras que quedan (lo que dice la landing: «Quedan N de M»). */
  cupos: number;
  /** Cuántos cupos de fundadoras hay en total. */
  totalCupos: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [datos, setDatos] = useState<EdicionDePlanes>(inicial);
  // El precio se escribe como texto para poder borrarlo del todo mientras se tipea.
  const [precios, setPrecios] = useState<Record<PlanClave, string>>(
    () => Object.fromEntries(CLAVES_PLAN.map((c) => [c, String(inicial.planes[c].precio)])) as Record<PlanClave, string>,
  );
  const [confirmando, setConfirmando] = useState(false);
  const [intento, setIntento] = useState(false);
  const [errorDelServidor, setErrorDelServidor] = useState<{ error: string; campos: Record<string, string> } | null>(null);
  const [anterioresAbiertas, setAnterioresAbiertas] = useState(false);

  const cambios = cambiosDePlanes(inicial, datos);
  const hayCambios = huellaDePlanes(datos) !== huella;
  const validacion = edicionDePlanesSchema.safeParse(datos);
  const errores: Record<string, string> = {
    ...(validacion.success ? {} : camposDeErrorDePlanes(validacion.error)),
    ...(errorDelServidor?.campos ?? {}),
  };
  // Los errores de lo que todavía no se tocó no se muestran hasta intentar guardar.
  const verError = (ruta: string) => (intento || errorDelServidor ? errores[ruta] : undefined);
  // Si un plan anterior tiene un error, no puede quedar escondido adentro del bloque plegado.
  const errorEnAnteriores =
    (intento || !!errorDelServidor) && ANTERIORES.some((c) => Object.keys(errores).some((ruta) => ruta.startsWith("planes." + c + ".")));
  const nombreDe = (clave: PlanClave) => datos.planes[clave].etiqueta.trim() || PLANES_POR_DEFECTO[clave].label;

  const cambiarPlan = <K extends keyof EdicionDePlanes["planes"][PlanClave]>(clave: PlanClave, campo: K, valor: EdicionDePlanes["planes"][PlanClave][K]) => {
    setErrorDelServidor(null);
    setDatos((d) => ({ ...d, planes: { ...d.planes, [clave]: { ...d.planes[clave], [campo]: valor } } }));
  };

  const cambiarPrecio = (clave: PlanClave, texto: string) => {
    const limpio = soloDigitos(texto).slice(0, 8);
    setPrecios((p) => ({ ...p, [clave]: limpio }));
    cambiarPlan(clave, "precio", aNumero(limpio));
  };

  const cambiarCondicion = (campo: "sedesMultisede" | "descuentoSedeExtra", valor: number) => {
    setErrorDelServidor(null);
    setDatos((d) => ({ ...d, condiciones: { ...d.condiciones, [campo]: valor } }));
  };

  const cambiarPack = (campo: keyof EdicionDePlanes["condiciones"]["pack"], valor: number) => {
    setErrorDelServidor(null);
    setDatos((d) => ({ ...d, condiciones: { ...d.condiciones, pack: { ...d.condiciones.pack, [campo]: valor } } }));
  };

  const alternarTipo = (tipo: (typeof TIPOS_INSTITUCION)[number], tildado: boolean) => {
    setErrorDelServidor(null);
    setDatos((d) => ({
      ...d,
      condiciones: {
        ...d.condiciones,
        // Siempre en el orden del catálogo, así "destildar y volver a tildar" no cuenta como un cambio.
        tiposColegio: TIPOS_INSTITUCION.filter((t) => (t === tipo ? tildado : d.condiciones.tiposColegio.includes(t))),
      },
    }));
  };

  const descartar = () => {
    setDatos(inicial);
    setPrecios(Object.fromEntries(CLAVES_PLAN.map((c) => [c, String(inicial.planes[c].precio)])) as Record<PlanClave, string>);
    setErrorDelServidor(null);
    setIntento(false);
  };

  const pedirGuardar = () => {
    setIntento(true);
    if (!validacion.success) {
      toast("Revisá los campos marcados.", "error");
      return;
    }
    setConfirmando(true);
  };

  const guardar = () =>
    empezar(async () => {
      try {
        const r = await guardarPlanes(datos, huella);
        if (!r.ok) {
          setConfirmando(false);
          setErrorDelServidor({ error: r.error, campos: r.campos ?? {} });
          toast(r.error, "error");
          return;
        }
        toast(r.data.cambios > 0 ? "Planes guardados" : "No había nada para guardar");
        setConfirmando(false);
        router.refresh();
      } catch {
        toast("No pudimos guardar los planes. Probá de nuevo.", "error");
      }
    });

  // A cuántas instituciones llega un cambio de precio: las que están hoy en ese plan.
  const alcanzadas = cambios.reduce((n, c) => (c.tipo === "precio" ? n + (cantidades[c.plan] ?? 0) : n), 0);
  const quitaUnPlan = cambios.some((c) => c.tipo === "plan" && c.campos.includes("si se ofrece") && !datos.planes[c.plan].vigente);

  const tarjetaDePlan = (clave: PlanClave) => {
    const p = datos.planes[clave];
    const base = PLANES_POR_DEFECTO[clave];
    const rutaPrecio = `planes.${clave}.precio`;
    const unidad = base.periodo === "año" ? "por año" : base.porSede ? "por mes y por sede" : "por mes";
    const cuantas = cantidades[clave] ?? 0;
    return (
      <Tarjeta key={clave} como="section" className="p-[22px]" aria-labelledby={`plan-${clave}`}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 id={`plan-${clave}`} className="m-0 text-[17px] leading-tight font-semibold">
            {nombreDe(clave)}
          </h3>
          <Insignia tono={p.vigente ? "verde" : "neutro"}>{p.vigente ? "Se ofrece" : "No se ofrece"}</Insignia>
          <span className="text-[13px] leading-none text-apagado">
            {cuantas === 0 ? "Ninguna institución lo tiene" : `${plural(cuantas, "institución", "instituciones")} lo ${cuantas === 1 ? "tiene" : "tienen"} hoy`}
          </span>
        </div>
        <p className="mt-0 mb-4 text-[13px] leading-normal text-apagado">{QUIEN_LO_RECIBE[clave]}</p>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,220px)] gap-x-4 gap-y-4 max-[760px]:grid-cols-1">
          <Campo etiqueta="Nombre del plan" error={verError(`planes.${clave}.etiqueta`)} requerido>
            <Input
              value={p.etiqueta}
              maxLength={60}
              aria-invalid={!!verError(`planes.${clave}.etiqueta`)}
              onChange={(e) => cambiarPlan(clave, "etiqueta", e.target.value)}
            />
          </Campo>
          <Campo
            etiqueta={`Precio ($ ${unidad})`}
            error={verError(rutaPrecio)}
            ayuda={p.precio > 0 ? `Se ve como ${pesos(p.precio)}` : undefined}
            requerido
          >
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={precios[clave]}
              aria-invalid={!!verError(rutaPrecio)}
              onChange={(e) => cambiarPrecio(clave, e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Resumen" ayuda="Una línea, debajo del nombre." error={verError(`planes.${clave}.resumen`)} className="min-[761px]:col-span-2">
            <Input
              value={p.resumen}
              maxLength={160}
              aria-invalid={!!verError(`planes.${clave}.resumen`)}
              onChange={(e) => cambiarPlan(clave, "resumen", e.target.value)}
            />
          </Campo>
          <Campo
            etiqueta="Detalle"
            ayuda={
              clave === "colegio" || clave === "deportiva"
                ? "Lo ve la institución al cambiar de plan. En la página pública se reemplaza por la lista de tipos de institución."
                : "Lo ve la institución al cambiar de plan y, en la página pública, quien mira los aranceles."
            }
            error={verError(`planes.${clave}.detalle`)}
            className="min-[761px]:col-span-2"
          >
            <Textarea
              rows={2}
              value={p.detalle}
              maxLength={300}
              aria-invalid={!!verError(`planes.${clave}.detalle`)}
              onChange={(e) => cambiarPlan(clave, "detalle", e.target.value)}
            />
          </Campo>
        </div>

        <div className="mt-3.5">
          <Casilla
            checked={p.vigente}
            disabled={SIEMPRE_VIGENTES.includes(clave)}
            onChange={(e) => cambiarPlan(clave, "vigente", e.target.checked)}
          >
            Se ofrece
            <span className="block text-xs text-sutil">
              {SIEMPRE_VIGENTES.includes(clave)
                ? "Siempre se ofrece: lo reciben las instituciones nuevas según su tipo."
                : "Se puede elegir al cambiar de plan y aparece en la página pública."}
            </span>
          </Casilla>
        </div>
      </Tarjeta>
    );
  };

  const pack = datos.condiciones.pack;

  // Vista previa de lo que va a ver la institución con lo que se está editando. Solo si lo editado es válido: con un pack roto no tiene sentido.
  const vista = validacion.success
    ? crearPlanes({
        planes: Object.fromEntries(
          CLAVES_PLAN.map((c) => {
            const p = datos.planes[c];
            return [c, { ...PLANES_POR_DEFECTO[c], label: p.etiqueta, precio: p.precio, resumen: p.resumen, detalle: p.detalle, vigente: p.vigente }];
          }),
        ) as CatalogoDePlanes["planes"],
        condiciones: { ...datos.condiciones, pack: { ...datos.condiciones.pack }, tiposColegio: [...datos.condiciones.tiposColegio] },
      })
    : null;
  const sedesParaMostrar = Array.from({ length: Math.min(datos.condiciones.sedesMultisede - 1, 6) }, (_, i) => i + 1);

  return (
    <>
      {errorDelServidor && (
        <div role="alert" className="mb-5 rounded-caja border border-[#F2C4C4] bg-[#FDECEC] px-[18px] py-3.5 text-[13.5px] leading-normal text-[#8A1F1F]">
          {errorDelServidor.error}
          {Object.keys(errorDelServidor.campos).length === 0 && (
            <>
              {" "}
              <button type="button" onClick={() => router.refresh()} className="cursor-pointer font-semibold underline">
                Recargar
              </button>
            </>
          )}
        </div>
      )}

      <p className="mt-0 mb-5 max-w-[78ch] text-[13.5px] leading-normal text-apagado">
        Esta pantalla está ordenada como la página pública de aranceles, que tiene tres tarjetas: <b className="font-semibold">Profesionales</b>,{" "}
        <b className="font-semibold">Instituciones</b> y <b className="font-semibold">Fundadoras</b>. Lo que cambies en cada bloque cambia esa tarjeta.
      </p>

      <div className="mb-6 flex flex-col gap-4">
        <EtiquetaSeccion className="mb-0">Tarjeta «Profesionales»</EtiquetaSeccion>
        <Tarjeta como="section" className="p-[22px]" aria-labelledby="profesionales-titulo">
          <h3 id="profesionales-titulo" className="m-0 mb-1 text-[17px] leading-tight font-semibold">
            100 % gratis, para siempre
          </h3>
          <p className="m-0 text-[13px] leading-normal text-apagado">
            Los profesionales no pagan nada: crear el perfil, verificarlo y postularse es gratis. No hay precios para editar en este bloque.
          </p>
        </Tarjeta>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <EtiquetaSeccion className="mb-0">Tarjeta «Instituciones»</EtiquetaSeccion>
        <p className="m-0 -mt-2 text-[13px] leading-normal text-apagado">
          En la página pública cada institución elige su tipo y ve el precio que le toca (Colegios, Clubes y academias o Multisede), más el pack por
          adelantado. Los tipos, las sedes y el pack se editan en «Condiciones», más abajo.
        </p>
        {VIGENTES.map(tarjetaDePlan)}
      </div>

      <Tarjeta como="section" className="mb-6 p-[22px]" aria-labelledby="condiciones-titulo">
        <h3 id="condiciones-titulo" className="m-0 mb-4 text-[17px] leading-tight font-semibold">
          Condiciones
        </h3>

        <h4 className="m-0 mb-2.5 text-sm leading-tight font-semibold text-tinta">Sedes y redes</h4>
        <div className="mb-3 grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
          <Campo
            etiqueta="Sedes para el plan Multisede"
            ayuda={`Desde ${datos.condiciones.sedesMultisede} sedes (incluida) corresponde el plan Multisede (redes: valor a convenir).`}
            error={verError("condiciones.sedesMultisede")}
          >
            <Input
              type="number"
              min={2}
              max={100}
              step={1}
              value={datos.condiciones.sedesMultisede}
              aria-invalid={!!verError("condiciones.sedesMultisede")}
              onChange={(e) => cambiarCondicion("sedesMultisede", aNumero(e.target.value))}
            />
          </Campo>
          <Campo
            etiqueta="Descuento por sede adicional (%)"
            ayuda={`Cada sede adicional (la 2.ª en adelante) paga el abono de su plan con ${datos.condiciones.descuentoSedeExtra} % de descuento: en Colegios, ${pesos(Math.round((datos.planes.colegio.precio * (100 - datos.condiciones.descuentoSedeExtra)) / 100))}; en Clubes y academias, ${pesos(Math.round((datos.planes.deportiva.precio * (100 - datos.condiciones.descuentoSedeExtra)) / 100))}. No cambia el plan Multisede, que ya cobra cada sede.`}
            error={verError("condiciones.descuentoSedeExtra")}
          >
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={datos.condiciones.descuentoSedeExtra}
              aria-invalid={!!verError("condiciones.descuentoSedeExtra")}
              onChange={(e) => cambiarCondicion("descuentoSedeExtra", aNumero(e.target.value))}
            />
          </Campo>
        </div>
        {vista && (
          <ul className="m-0 mb-6 flex list-none flex-col gap-1 rounded-caja bg-superficie px-3.5 py-3 text-[13px] leading-normal text-tinta-2">
            <li className="text-xs font-semibold tracking-[.04em] text-sutil uppercase">Así queda lo que paga por mes</li>
            {(["colegio", "deportiva"] as const).map((c) => (
              <li key={c}>
                <b className="font-semibold text-tinta">{vista.nombreDePlan(c)}:</b>{" "}
                {sedesParaMostrar.map((n) => `${n} ${n === 1 ? "sede" : "sedes"} ${pesos(vista.montoDePlan(c, n))}`).join(" · ")}
              </li>
            ))}
            <li className="text-apagado">Desde {datos.condiciones.sedesMultisede} sedes: plan Multisede, que se asigna a mano (redes: valor a convenir).</li>
          </ul>
        )}

        <h4 className="m-0 mb-2.5 text-sm leading-tight font-semibold text-tinta">Semestre</h4>
        <fieldset className="m-0 mb-6 min-w-0 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold text-apagado">Pack por adelantado</legend>
          <div className="grid grid-cols-3 gap-4 max-[760px]:grid-cols-1">
            <Campo etiqueta="Meses del pack" error={verError("condiciones.pack.meses")}>
              <Input type="number" min={2} max={24} step={1} value={pack.meses} onChange={(e) => cambiarPack("meses", aNumero(e.target.value))} aria-invalid={!!verError("condiciones.pack.meses")} />
            </Campo>
            <Campo etiqueta="Meses que se pagan" error={verError("condiciones.pack.mesesQueSePagan")}>
              <Input type="number" min={1} max={24} step={1} value={pack.mesesQueSePagan} onChange={(e) => cambiarPack("mesesQueSePagan", aNumero(e.target.value))} aria-invalid={!!verError("condiciones.pack.mesesQueSePagan")} />
            </Campo>
            <Campo etiqueta="Meses que se pagan con referido" error={verError("condiciones.pack.mesesConReferido")}>
              <Input type="number" min={1} max={24} step={1} value={pack.mesesConReferido} onChange={(e) => cambiarPack("mesesConReferido", aNumero(e.target.value))} aria-invalid={!!verError("condiciones.pack.mesesConReferido")} />
            </Campo>
          </div>
          <p className="mt-2 mb-0 text-xs leading-normal text-sutil">
            Hoy: contratando {pack.meses} meses por adelantado se pagan {pack.mesesQueSePagan}, y si recomienda a una institución que se suma, {pack.mesesConReferido}. Este último valor es el beneficio del módulo Referidos (lo ve cada institución en su menú y lo aplicás desde Referidos); ya no se muestra en la página de precios.
          </p>
          <p className="mt-1.5 mb-0 text-xs leading-normal text-sutil">
            El semestre al contado se registra desde la ficha de cobros de cada institución («Registrar semestre al contado»): queda una factura paga que
            cubre los {pack.meses} meses y no se cobra mes a mes.
          </p>
          {vista && (
            <ul className="m-0 mt-3 flex list-none flex-col gap-1 rounded-caja bg-superficie px-3.5 py-3 text-[13px] leading-normal text-tinta-2">
              <li className="text-xs font-semibold tracking-[.04em] text-sutil uppercase">Así queda el semestre (una sede)</li>
              {(["colegio", "deportiva"] as const).map((c) => {
                const total = vista.packDe(c);
                return (
                  <li key={c}>
                    <b className="font-semibold text-tinta">{vista.nombreDePlan(c)}</b> ({pesos(datos.planes[c].precio)} por mes): al contado{" "}
                    <b className="font-semibold text-tinta">{pesos(total.anticipado)}</b> en lugar de {pesos(total.lista)}; con referido{" "}
                    <b className="font-semibold text-tinta">{pesos(total.conReferido)}</b>.
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby="tipos-ayuda">
          <legend className="mb-1 p-0 text-xs font-semibold text-apagado">Arancel de colegios</legend>
          <p id="tipos-ayuda" className="mt-0 mb-2.5 text-xs leading-normal text-sutil">
            Las instituciones de estos tipos pagan el plan de Colegios; las demás, el de Clubes y academias.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2.5">
            {TIPOS_INSTITUCION.map((tipo) => (
              <Casilla
                key={tipo}
                className="min-w-[200px]"
                checked={datos.condiciones.tiposColegio.includes(tipo)}
                onChange={(e) => alternarTipo(tipo, e.target.checked)}
              >
                {tipo}
              </Casilla>
            ))}
          </div>
          {verError("condiciones.tiposColegio") && (
            <span role="alert" className="mt-2 block text-xs text-[#b91c1c]">
              {verError("condiciones.tiposColegio")}
            </span>
          )}
        </fieldset>
      </Tarjeta>

      <div className="mb-6 flex flex-col gap-4">
        <EtiquetaSeccion className="mb-0">Tarjeta «Fundadoras»</EtiquetaSeccion>
        <p className="m-0 -mt-2 text-[13px] leading-normal text-apagado">
          {cupos > 0
            ? "La página pública muestra «Las primeras " + totalCupos + "» y «Quedan " + cupos + " de " + totalCupos + "»."
            : "Hoy no quedan cupos de fundadoras, así que la página pública no muestra esta tarjeta."}{" "}
          Los cupos se cuentan por antigüedad entre las instituciones reales, no por plan, y el total ({totalCupos}) está fijo en el sistema. Esta tarjeta
          no muestra precio: el que se cobra a las fundadoras es el del plan de abajo.
        </p>
        {FUNDADORAS.map(tarjetaDePlan)}
      </div>

      <details
        open={anterioresAbiertas || errorEnAnteriores}
        onToggle={(e) => setAnterioresAbiertas(e.currentTarget.open)}
        className="mb-6 rounded-tarjeta border border-linea bg-white"
      >
        <summary className="cursor-pointer px-[22px] py-4 text-[15px] leading-tight font-semibold text-tinta">
          Planes anteriores (Estándar y Anual) ·{" "}
          <span className="font-normal text-apagado">
            {plural((cantidades.estandar ?? 0) + (cantidades.anual ?? 0), "institución", "instituciones")} los tienen hoy
          </span>
        </summary>
        <div className="flex flex-col gap-4 px-[22px] pt-1 pb-[22px]">
          <p className="m-0 text-[13px] leading-normal text-apagado">
            Ya no se venden y no tienen tarjeta en la página pública, pero las facturas viejas y algunas cuentas todavía los usan. Cambiar su precio
            cambia lo que se les factura de ahora en más.
          </p>
          {ANTERIORES.map(tarjetaDePlan)}
        </div>
      </details>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-tarjeta border border-linea bg-white/95 px-5 py-3.5 shadow-[0_-4px_14px_rgba(31,36,33,.06)] backdrop-blur">
        <span className="text-[13.5px] leading-normal text-apagado" aria-live="polite">
          {hayCambios ? `Cambios sin guardar: ${cambios.length}` : "Todo guardado"}
        </span>
        <div className="flex gap-2.5 max-[560px]:w-full max-[560px]:[&>*]:flex-1">
          <Boton variante="secundario" onClick={descartar} disabled={!hayCambios || pendiente}>
            Descartar
          </Boton>
          <Boton onClick={pedirGuardar} disabled={!hayCambios || pendiente}>
            Guardar cambios
          </Boton>
        </div>
      </div>

      <DialogoModal abierto={confirmando} onCerrar={() => !pendiente && setConfirmando(false)} titulo="¿Guardar estos cambios?" ancho={520}>
        <ul className="m-0 mb-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-normal text-tinta">
          {cambios.map((c, i) => (
            <li key={i}>{describirCambioDePlanes(c, nombreDe)}</li>
          ))}
        </ul>
        <p className="m-0 mb-1.5 text-[13px] leading-normal text-apagado">
          Rige desde ya en la página pública y en todo lo que se calcule de ahora en más.
          {alcanzadas > 0 && ` Alcanza a ${plural(alcanzadas, "institución", "instituciones")} que hoy ${alcanzadas === 1 ? "tiene" : "tienen"} ese plan: sus próximas facturas salen con el precio nuevo.`}{" "}
          Las facturas ya emitidas no cambian.
        </p>
        {quitaUnPlan && (
          <p className="m-0 mb-1.5 text-[13px] leading-normal text-[#8A4B07]">
            Un plan que deja de ofrecerse no se puede elegir al cambiar de plan; las instituciones que ya lo tienen lo conservan.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2.5 max-[560px]:flex-col-reverse">
          <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={pendiente}>
            Seguir editando
          </Boton>
          <Boton onClick={guardar} disabled={pendiente}>
            {pendiente ? "Guardando…" : "Confirmar y guardar"}
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
