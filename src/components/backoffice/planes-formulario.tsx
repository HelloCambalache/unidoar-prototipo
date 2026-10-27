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
  MAX_MESES_DE_PACK,
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
  multisede:
    "Se asigna a mano desde la ficha de la institución (redes de varias sedes). En la página pública se muestra «A convenir»: este precio por sede es el de base cuando se asigna sin un convenio a medida (que se carga desde Cobros → Precio).",
  puntual:
    "Se asigna a mano desde la ficha de la institución (o al aprobar un pedido de cambio de plan). No tiene abono: se paga cada búsqueda, y el pago lo registra el equipo en la ficha de cobros.",
  fundador:
    "Lo reciben solas las primeras instituciones que crean su cuenta (hasta el cupo de abajo), en lugar del arancel de su tipo; el equipo también puede asignarlo desde la ficha. Su precio no se muestra en la parte pública.",
};

/** Los dos planes que reciben a las instituciones nuevas: no se pueden dejar de ofrecer. */
const SIEMPRE_VIGENTES: readonly PlanClave[] = ["colegio", "deportiva"];

/**
 * Los planes con abono que se ofrecen hoy: los de la tarjeta «Instituciones». La búsqueda puntual (sin abono) y el Plan Fundador (que no se
 * muestra con precio en la página pública) tienen cada uno su propio bloque.
 */
const VIGENTES: readonly PlanClave[] = CLAVES_PLAN.filter((c) => c !== "fundador" && PLANES_POR_DEFECTO[c].vigente && PLANES_POR_DEFECTO[c].periodo !== "evento");
const PUNTUAL: readonly PlanClave[] = ["puntual"];

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
}: {
  inicial: EdicionDePlanes;
  /** Huella de lo guardado cuando se abrió la pantalla (`huellaDePlanes`): el servidor no pisa lo que otra persona cambió mientras tanto. */
  huella: string;
  /** Cuántas instituciones tiene hoy cada plan. */
  cantidades: Record<PlanClave, number>;
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

  const cambios = cambiosDePlanes(inicial, datos);
  const hayCambios = huellaDePlanes(datos) !== huella;
  const validacion = edicionDePlanesSchema.safeParse(datos);
  const errores: Record<string, string> = {
    ...(validacion.success ? {} : camposDeErrorDePlanes(validacion.error)),
    ...(errorDelServidor?.campos ?? {}),
  };
  // Los errores de lo que todavía no se tocó no se muestran hasta intentar guardar.
  const verError = (ruta: string) => (intento || errorDelServidor ? errores[ruta] : undefined);
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

  const cambiarPuntual = <K extends keyof EdicionDePlanes["condiciones"]["puntual"]>(campo: K, valor: EdicionDePlanes["condiciones"]["puntual"][K]) => {
    setErrorDelServidor(null);
    setDatos((d) => ({ ...d, condiciones: { ...d.condiciones, puntual: { ...d.condiciones.puntual, [campo]: valor } } }));
  };

  const cambiarCondicion = (campo: "sedesMultisede" | "descuentoSedeExtra" | "referidoMesesMensual" | "cuposFundador", valor: number) => {
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
    const unidad = base.periodo === "evento" ? "por búsqueda" : base.porSede ? "por mes y por sede" : "por mes";
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
            etiqueta={base.porSede ? "Precio base por sede ($ por mes, uso interno)" : `Precio de lista ($ ${unidad})`}
            error={verError(rutaPrecio)}
            ayuda={
              base.porSede
                ? "Uso interno: la página pública y «Cambiar de plan» muestran «A convenir según el volumen». Es lo que se factura por sede si se asigna Multisede sin un convenio a medida."
                : clave === "fundador"
                  ? `${p.precio > 0 ? `Se ve como ${pesos(p.precio)}. ` : ""}Solo lo ve quien tiene este plan, en su Plan y facturación: la página pública y el alta no lo muestran.`
                  : p.precio > 0
                    ? `Se ve como ${pesos(p.precio)}`
                    : undefined
            }
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
                : clave === "fundador"
                  ? "Si lo apagás, las cuentas nuevas dejan de recibirlo, desaparece la tarjeta de fundadoras de la página pública y quedan igual quienes ya lo tienen."
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
        Esta pantalla está ordenada como la página pública de aranceles, que tiene dos tarjetas (<b className="font-semibold">Profesionales</b> e{" "}
        <b className="font-semibold">Instituciones</b>) y, mientras queden lugares, una tercera de <b className="font-semibold">Fundadoras</b> que no muestra
        precio. Lo que cambies en cada bloque cambia esa tarjeta.
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

      <div className="mb-6 flex flex-col gap-4">
        <EtiquetaSeccion className="mb-0">Tarjeta «Fundadoras»</EtiquetaSeccion>
        <p className="m-0 -mt-2 text-[13px] leading-normal text-apagado">
          Para las primeras instituciones que se suman. En la página pública la tarjeta dice «las primeras {datos.condiciones.cuposFundador}» y lista los
          beneficios (insignia de fundadora en su perfil y su logo en la portada), <b className="font-semibold">sin mostrar el precio</b>: el valor lo cargás acá, como el de
          cualquier plan.
        </p>
        {tarjetaDePlan("fundador")}
        <Tarjeta como="section" className="p-[22px]" aria-labelledby="cupos-fundador-titulo">
          <h3 id="cupos-fundador-titulo" className="m-0 mb-1 text-[17px] leading-tight font-semibold">
            Cupos de fundadoras
          </h3>
          <p className="mt-0 mb-4 text-[13px] leading-normal text-apagado">
            {(() => {
              const ocupados = cantidades.fundador ?? 0;
              const quedan = Math.max(0, datos.condiciones.cuposFundador - ocupados);
              return `Hoy ${plural(ocupados, "institución es fundadora", "instituciones son fundadoras")} y ${quedan === 0 ? "no queda ningún lugar" : `quedan ${plural(quedan, "lugar", "lugares")}`}. Las cuentas nuevas reciben el plan solas hasta completar el cupo; después, el arancel de su tipo.`;
            })()}
          </p>
          <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
            <Campo
              etiqueta="Cupos de instituciones fundadoras"
              ayuda="Cuántas instituciones pueden tener el Plan Fundador al mismo tiempo. Bajarlo no le saca el plan a nadie."
              error={verError("condiciones.cuposFundador")}
            >
              <Input
                type="number"
                min={1}
                max={1000}
                step={1}
                value={datos.condiciones.cuposFundador}
                aria-invalid={!!verError("condiciones.cuposFundador")}
                onChange={(e) => cambiarCondicion("cuposFundador", aNumero(e.target.value))}
              />
            </Campo>
          </div>
        </Tarjeta>
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
              <Input type="number" min={2} max={MAX_MESES_DE_PACK} step={1} value={pack.meses} onChange={(e) => cambiarPack("meses", aNumero(e.target.value))} aria-invalid={!!verError("condiciones.pack.meses")} />
            </Campo>
            <Campo etiqueta="Meses que se pagan" error={verError("condiciones.pack.mesesQueSePagan")}>
              <Input type="number" min={1} max={MAX_MESES_DE_PACK} step={1} value={pack.mesesQueSePagan} onChange={(e) => cambiarPack("mesesQueSePagan", aNumero(e.target.value))} aria-invalid={!!verError("condiciones.pack.mesesQueSePagan")} />
            </Campo>
            <Campo etiqueta="Meses que se pagan con referido" error={verError("condiciones.pack.mesesConReferido")}>
              <Input type="number" min={1} max={MAX_MESES_DE_PACK} step={1} value={pack.mesesConReferido} onChange={(e) => cambiarPack("mesesConReferido", aNumero(e.target.value))} aria-invalid={!!verError("condiciones.pack.mesesConReferido")} />
            </Campo>
          </div>
          <p className="mt-2 mb-0 text-xs leading-normal text-sutil">
            Hoy: contratando {pack.meses} meses por adelantado se pagan {pack.mesesQueSePagan}, y si gasta un mes bonificado por recomendar (módulo Referidos), {pack.mesesConReferido}. Ese semestre con mes bonificado se registra desde la ficha de cobros; el valor ya no se muestra en la página de precios.
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

        <h4 className="m-0 mb-2.5 text-sm leading-tight font-semibold text-tinta">Referidos</h4>
        <fieldset className="m-0 mb-6 min-w-0 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold text-apagado">Meses bonificados por recomendación</legend>
          <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
            <Campo etiqueta="Meses bonificados por cada institución recomendada" error={verError("condiciones.referidoMesesMensual")}>
              <Input
                type="number"
                min={0}
                max={12}
                step={1}
                value={datos.condiciones.referidoMesesMensual}
                aria-invalid={!!verError("condiciones.referidoMesesMensual")}
                onChange={(e) => cambiarCondicion("referidoMesesMensual", aNumero(e.target.value))}
              />
            </Campo>
          </div>
          <p className="mt-2 mb-0 text-xs leading-normal text-sutil">
            {datos.condiciones.referidoMesesMensual > 0
              ? `Cuando la institución recomendada paga su primera factura, desde Referidos le sumás ${datos.condiciones.referidoMesesMensual} ${datos.condiciones.referidoMesesMensual === 1 ? "mes bonificado" : "meses bonificados"} a quien la recomendó. Se usa como máximo 1 por semestre (lo que sobra queda guardado): en una factura mensual no se factura ese mes, con débito automático Mercado Pago cobra igual y Referidos te avisa para devolverlo a mano, y en un semestre al contado se paga un mes menos (lo que fijás arriba en «Meses que se pagan con referido»).`
              : "En 0 no se pueden aplicar beneficios de referidos."}
          </p>
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
        <EtiquetaSeccion className="mb-0">Búsqueda puntual (sin abono mensual)</EtiquetaSeccion>
        <p className="m-0 -mt-2 text-[13px] leading-normal text-apagado">
          Para una institución que solo necesita cubrir una vacante: paga cada búsqueda, sin abono mensual ni factura por mes. El equipo registra el pago desde
          su ficha de cobros y la institución queda con una búsqueda pagada para publicar; pasada su vigencia, la búsqueda se cierra sola. El precio de lista
          se edita acá; el equipo puede acordar un precio menor con cada institución desde su ficha de cobros.
        </p>
        {PUNTUAL.map(tarjetaDePlan)}
        <Tarjeta como="section" className="p-[22px]" aria-labelledby="puntual-titulo">
          <h3 id="puntual-titulo" className="m-0 mb-3 text-[17px] leading-tight font-semibold">
            Condiciones de la búsqueda puntual
          </h3>
          <div className="mb-4 grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
            <Campo
              etiqueta="Días que queda publicada"
              ayuda="Pasado ese plazo la búsqueda se cierra sola (el cierre lo hace el proceso diario)."
              error={verError("condiciones.puntual.vigenciaDias")}
            >
              <Input
                type="number"
                min={1}
                max={365}
                step={1}
                value={datos.condiciones.puntual.vigenciaDias}
                aria-invalid={!!verError("condiciones.puntual.vigenciaDias")}
                onChange={(e) => cambiarPuntual("vigenciaDias", aNumero(e.target.value))}
              />
            </Campo>
            <Campo
              etiqueta="Búsquedas abiertas a la vez"
              ayuda="Cuántas puede tener publicadas al mismo tiempo, aunque haya pagado más."
              error={verError("condiciones.puntual.busquedasAbiertas")}
            >
              <Input
                type="number"
                min={1}
                max={20}
                step={1}
                value={datos.condiciones.puntual.busquedasAbiertas}
                aria-invalid={!!verError("condiciones.puntual.busquedasAbiertas")}
                onChange={(e) => cambiarPuntual("busquedasAbiertas", aNumero(e.target.value))}
              />
            </Campo>
          </div>
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-2 p-0 text-xs font-semibold text-apagado">Qué incluye</legend>
            <div className="flex flex-col gap-2.5">
              <Casilla checked={datos.condiciones.puntual.incluyeCursos} onChange={(e) => cambiarPuntual("incluyeCursos", e.target.checked)}>
                Difusión de cursos
                <span className="block text-xs text-sutil">Puede publicar cursos y los profesionales los ven. Sin tildar, no aparece en su menú y no puede crearlos.</span>
              </Casilla>
              <Casilla checked={datos.condiciones.puntual.incluyeBuscador} onChange={(e) => cambiarPuntual("incluyeBuscador", e.target.checked)}>
                Buscador y base de profesionales
                <span className="block text-xs text-sutil">
                  Son los beneficios continuos del abono. Sin tildar, no aparecen en su menú. Siempre ve a quienes se postulan a su búsqueda.
                </span>
              </Casilla>
            </div>
          </fieldset>
        </Tarjeta>
      </div>

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
