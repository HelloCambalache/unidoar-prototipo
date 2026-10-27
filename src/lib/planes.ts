import { z } from "zod";
import { TIPOS_INSTITUCION } from "@/lib/catalogo";

/*
 * Planes de las instituciones, en pesos argentinos. Los profesionales no pagan nunca.
 *
 * Lo que se cobra y cómo se llama cada plan lo edita el equipo desde el backoffice (/backoffice/planes) y vive en la base
 * (`planes` y `planes_condiciones`). Este archivo tiene la FORMA de esos datos, los valores de lanzamiento (el respaldo: si la
 * base no responde o le falta algo, se usan estos) y las reglas puras que trabajan sobre un catálogo (`crearPlanes`): sin acceso
 * a base, así sirven igual en el servidor y en el navegador. El servidor arma el catálogo con `planes()` (src/lib/queries/planes.ts)
 * y se lo pasa a los componentes de cliente por props.
 *
 * El precio sale del TIPO de institución, no de lo que elija: un colegio paga lo mismo que cualquier otro colegio. Por eso
 * `planPorTipo()` decide el plan y el selector del backoffice solo confirma lo que el tipo ya decide.
 *
 * Un plan marcado `vigente: false` es uno que el equipo dejó de ofrecer (Multisede o la búsqueda puntual se pueden apagar): sigue acá
 * porque las facturas guardan la clave del plan al momento del cobro (`facturas.plan`) y puede haber cuentas que lo tienen. No se ofrece a
 * nadie nuevo. Las claves son fijas (no se crean ni se borran planes desde el backoffice): una factura o una institución las referencian.
 * Los planes de antes del esquema de 2026-10 (Estándar y Anual) se retiraron: las cuentas que los tenían pasaron al plan de su tipo. **El Plan
 * Fundador volvió** (2026-10-27): es para las primeras N instituciones que se suman (`condiciones.cuposFundador`, 50 de lanzamiento), con su
 * precio editable en Planes como cualquier otro, y **su precio nunca se muestra en la parte pública** (la página dice «las primeras 50» y los
 * beneficios, no cuánto cuesta). Ver `cuposDeFundador` y `catalogoParaNavegador`.
 */

/** Cada cuánto se cobra un plan: por mes o por evento (la búsqueda puntual: se paga cada búsqueda, sin abono). */
export type Periodo = "mes" | "evento";

export type Plan = {
  label: string;
  /** Precio de lista (el tope del rango). */
  precio: number;
  /**
   * Precio mínimo (el piso del rango): hasta dónde puede bajar el equipo el abono de una institución al acordar un precio con ella. Sin piso
   * (null) el abono no se negocia: vale el de lista.
   */
  precioMinimo: number | null;
  periodo: Periodo;
  resumen: string;
  detalle: string;
  /** Se ofrece hoy. Los heredados solo sirven para leer el pasado. */
  vigente: boolean;
  /** El precio es por sede, no por institución: el total lo arma el backoffice al facturar. */
  porSede: boolean;
};

export const CLAVES_PLAN = ["colegio", "deportiva", "multisede", "puntual", "fundador"] as const;
export type PlanClave = (typeof CLAVES_PLAN)[number];

export const esClavePlan = (v: unknown): v is PlanClave => typeof v === "string" && (CLAVES_PLAN as readonly string[]).includes(v);

/**
 * Hasta cuántos meses puede tener el pack por adelantado. Un año: las consultas que miran si un mes ya está cubierto por un pago por adelantado
 * leen los últimos 12 meses de facturas, así que un pack más largo se facturaría mes a mes pasado el año aunque siguiera pago.
 */
export const MAX_MESES_DE_PACK = 12;

/** Pack por adelantado: los meses bonificados no cambian el precio mensual, se descuentan de los que se facturan. */
export type PackDeLanzamiento = {
  meses: number;
  /** Pagando los meses por adelantado se bonifican los que faltan hasta `meses`. */
  mesesQueSePagan: number;
  /** Si además recomienda una institución que se suma, se bonifica otro. */
  mesesConReferido: number;
};

/** Lo que define a la búsqueda puntual (el plan sin abono: se paga cada búsqueda). Todo lo edita el equipo en Planes. */
export type CondicionesDePuntual = {
  /** Cuántos días queda publicada una búsqueda puntual: pasado ese plazo se cierra sola. */
  vigenciaDias: number;
  /** Cuántas búsquedas puntuales puede tener abiertas a la vez. */
  busquedasAbiertas: number;
  /** Si una institución con búsquedas puntuales puede publicar cursos (difusión de cursos). */
  incluyeCursos: boolean;
  /** Si puede usar el buscador de profesionales y la base de profesionales (los «beneficios continuos»). */
  incluyeBuscador: boolean;
};

export type CondicionesDePlanes = {
  /** Desde esta cantidad de sedes (incluida) corresponde el plan Multisede (redes: valor a convenir). */
  sedesMultisede: number;
  /**
   * Descuento, en porcentaje, sobre el abono del plan para cada sede adicional (de la segunda en adelante). 50 = cada sede extra paga la
   * mitad; 0 = paga lo mismo que la primera; 100 = no se cobra. No se aplica a un plan por sede (Multisede), que ya cobra cada sede.
   */
  descuentoSedeExtra: number;
  pack: PackDeLanzamiento;
  /**
   * Meses que se bonifican por cada institución recomendada a quien paga mes a mes (opción B de Referidos, ver src/lib/bonificacion.ts).
   * 0 = no se ofrece: el beneficio solo se aplica como pack por adelantado.
   */
  referidoMesesMensual: number;
  /**
   * Cuántas instituciones pueden ser fundadoras (el Plan Fundador es para las primeras que se suman). Con `cupos` ocupados por quienes ya tienen
   * ese plan, lo que queda es `cuposDeFundador(ocupados)`. Lo edita el equipo en Planes.
   */
  cuposFundador: number;
  /** La búsqueda puntual: vigencia, tope de búsquedas abiertas y qué incluye. */
  puntual: CondicionesDePuntual;
  /** Tipos de institución que pagan el arancel de colegios; el resto paga el deportivo. */
  tiposColegio: string[];
};

export type CatalogoDePlanes = { planes: Record<PlanClave, Plan>; condiciones: CondicionesDePlanes };

/**
 * Un precio acordado con una institución (lo carga el equipo desde su ficha de cobros). Tiene dos modalidades:
 *  - "abono": un abono propio dentro del rango del plan (entre el piso y la lista). Reemplaza al precio de lista como abono de la primera sede,
 *    y las sedes adicionales siguen con su descuento sobre ESE abono.
 *  - "total": un monto mensual fijo a medida (el convenio de una red): es lo que paga por mes sin importar cuántas sedes tenga.
 */
export type AcuerdoDePrecio = {
  modalidad: "abono" | "total";
  monto: number;
  /**
   * El plan de la institución cuando se acordó el precio. Un acuerdo solo rige con ese plan (`acuerdoQueRige`): un abono de $29.000 acordado
   * en Clubes no se puede cobrar en Colegios, ni un convenio mensual en una búsqueda puntual. Sin plan anotado (acuerdos anteriores a este
   * control) vale con cualquiera, como antes.
   */
  plan?: string | null;
};

/* ───────────────────────────── Valores de lanzamiento (respaldo) ───────────────────────────── */

export const PLANES_POR_DEFECTO: Record<PlanClave, Plan> = {
  colegio: {
    label: "Plan Colegios",
    precio: 50_000,
    precioMinimo: 48_000,
    periodo: "mes",
    resumen: "Búsquedas ilimitadas, sin comisión por contratación.",
    detalle: "Jardines, primarias, secundarias y terciarios, privados o públicos.",
    vigente: true,
    porSede: false,
  },
  deportiva: {
    label: "Plan Clubes y academias",
    precio: 30_000,
    precioMinimo: 28_000,
    periodo: "mes",
    resumen: "Búsquedas ilimitadas, sin comisión por contratación.",
    detalle: "Clubes, gimnasios, academias, escuelas deportivas, natatorios y centros de formación.",
    vigente: true,
    porSede: false,
  },
  multisede: {
    label: "Plan Multisede",
    precio: 15_000,
    precioMinimo: null,
    periodo: "mes",
    resumen: "Para redes y cadenas de 5 sedes o más: valor a convenir según el volumen.",
    detalle: "Convenio corporativo: el valor se acuerda según la cantidad de sedes y de búsquedas.",
    vigente: true,
    porSede: true,
  },
  puntual: {
    label: "Búsqueda puntual",
    precio: 110_000,
    precioMinimo: 95_000,
    periodo: "evento",
    resumen: "Una vacante puntual, sin abono mensual.",
    detalle: "Para cubrir un puesto puntual: pagás solo esa búsqueda, sin abono mensual.",
    vigente: true,
    porSede: false,
  },
  // El precio de lanzamiento es un respaldo neutro (el de Colegios): el valor real lo carga el equipo en Planes y nunca se muestra en la parte
  // pública. Nadie lo paga antes de que el equipo cargue su primera factura (el cron no factura una cuenta sin facturas previas).
  fundador: {
    label: "Plan Fundador",
    precio: 50_000,
    precioMinimo: null,
    periodo: "mes",
    resumen: "Para las primeras instituciones que se suman: búsquedas ilimitadas, sin comisión por contratación.",
    detalle: "Un valor de fundadora y el reconocimiento de haber estado desde el día uno.",
    vigente: true,
    porSede: false,
  },
};

export const CONDICIONES_POR_DEFECTO: CondicionesDePlanes = {
  sedesMultisede: 5,
  descuentoSedeExtra: 50,
  pack: { meses: 6, mesesQueSePagan: 5, mesesConReferido: 4 },
  referidoMesesMensual: 1,
  cuposFundador: 50,
  puntual: { vigenciaDias: 30, busquedasAbiertas: 1, incluyeCursos: false, incluyeBuscador: false },
  tiposColegio: ["Colegio privado", "Colegio público", "Jardín de infantes", "Instituto terciario", "Universidad"],
};

export const CATALOGO_POR_DEFECTO: CatalogoDePlanes = { planes: PLANES_POR_DEFECTO, condiciones: CONDICIONES_POR_DEFECTO };

export const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

/**
 * El catálogo sin lo que es del equipo, para mandarlo al navegador de una visita o de una institución: los componentes de cliente lo reciben por
 * props y quedan a la vista en el código de la página. Se quita el piso del rango de precio (con el que se negocia), los meses que se bonifican
 * por recomendar y, con `sinPrecioPorSede`, el precio base interno del plan por sede (la página pública dice «a convenir»). Ningún componente
 * fuera del backoffice usa esos valores; todo lo demás (listas, descuento por sede, pack, condiciones de la búsqueda puntual) queda igual.
 */
export function catalogoParaNavegador(
  catalogo: CatalogoDePlanes,
  opciones: {
    sinPrecioPorSede?: boolean;
    /** Sin el precio del Plan Fundador: la parte pública y el alta no lo muestran (solo lo ve quien lo tiene, en su Plan y facturación). */
    sinPrecioDeFundador?: boolean;
  } = {},
): CatalogoDePlanes {
  const planes = Object.fromEntries(
    CLAVES_PLAN.map((c) => {
      const p = catalogo.planes[c];
      const sinPrecio = (opciones.sinPrecioPorSede && p.porSede) || (opciones.sinPrecioDeFundador && c === "fundador");
      return [c, { ...p, precioMinimo: null, ...(sinPrecio ? { precio: 0 } : {}) }];
    }),
  ) as Record<PlanClave, Plan>;
  return {
    planes,
    condiciones: {
      ...catalogo.condiciones,
      referidoMesesMensual: 0,
      pack: { ...catalogo.condiciones.pack, mesesConReferido: catalogo.condiciones.pack.mesesQueSePagan },
    },
  };
}

/* ───────────────────────────── Reglas sobre un catálogo ───────────────────────────── */

/**
 * Todo lo que se puede preguntar sobre los planes, ya atado a un catálogo. En el servidor: `await planes()`; en un componente de
 * cliente: `crearPlanes(catalogo)` con el catálogo que le llegó por props.
 */
export function crearPlanes(catalogo: CatalogoDePlanes) {
  const { planes, condiciones } = catalogo;

  /** El plan de una clave; ante una clave desconocida cae en el de colegios. */
  const planDe = (clave: string): Plan => planes[esClavePlan(clave) ? clave : "colegio"];

  /** Los que se ofrecen hoy, en orden. */
  const vigentes: PlanClave[] = CLAVES_PLAN.filter((c) => planes[c].vigente);

  /** Es el Plan Fundador (el de las primeras instituciones que se suman). */
  const esFundador = (clave: string) => clave === "fundador";
  /**
   * Cuántos lugares de fundadora quedan, dado cuántas instituciones ya tienen el plan (`ocupados`). Con el plan apagado (el equipo dejó de
   * ofrecerlo) no queda ninguno: nadie nuevo lo recibe aunque sobren cupos.
   */
  const cuposDeFundador = (ocupados: number) => (planes.fundador.vigente ? Math.max(0, condiciones.cuposFundador - Math.max(0, ocupados)) : 0);
  /**
   * Los planes que se ofrecen en la parte pública (el selector de precios de /planes): todos los vigentes menos el Fundador, cuyo precio no se
   * muestra (la página lo presenta aparte, sin valor).
   */
  const vigentesPublicos: PlanClave[] = vigentes.filter((c) => !esFundador(c));

  /**
   * Las claves que puede elegir un selector: las vigentes más, si la institución está en un plan heredado, el suyo, así el
   * backoffice puede dejarla donde está sin ofrecérselo a otras.
   */
  const clavesParaElegir = (actual?: string): PlanClave[] =>
    esClavePlan(actual) && !planes[actual].vigente ? [...vigentes, actual] : [...vigentes];

  const tiposColegio: readonly string[] = condiciones.tiposColegio;
  /** El plan que le corresponde a una institución por su tipo. Multisede se asigna a mano. */
  const planPorTipo = (tipo: string): PlanClave => (tiposColegio.includes(tipo) ? "colegio" : "deportiva");
  /**
   * Los planes que una institución puede pedir desde «Cambiar de plan»: el arancel que le toca por su tipo (un colegio no puede pedir el de
   * clubes, que es más barato) y, solo si tiene sedes para una red, Multisede; siempre que se sigan ofreciendo. Más el plan en el que ya
   * está, que se muestra como actual aunque ya no se ofrezca. En el orden de siempre. **La búsqueda puntual no está**: no es un plan al que
   * se cambie, es algo que se paga cuando no se quiere abono (se elige al crear la cuenta, o el equipo la asigna a pedido); quien ya está
   * en ella la ve como actual y puede pasarse al abono de su tipo.
   */
  const planesParaPedir = (tipo: string, sedes: number, actual?: string): PlanClave[] => {
    const posibles: PlanClave[] = [planPorTipo(tipo)];
    if (sedes >= condiciones.sedesMultisede) posibles.push("multisede");
    return CLAVES_PLAN.filter((c) => (posibles.includes(c) && planes[c].vigente) || c === actual);
  };
  /**
   * El plan que le toca a una institución cuando cambia su tipo. Solo se mueve si el plan que tiene era el que le correspondía por su tipo
   * anterior (el que se le asignó solo al crearla): uno que el equipo cambió a mano (Multisede…) no se toca. Sin esto, alguien
   * podía elegir "Otro" (arancel deportivo), cambiar después a "Colegio" antes de verificarse y quedarse con el plan más barato.
   */
  const planTrasCambiarElTipo = (planActual: string, tipoAnterior: string, tipoNuevo: string): string =>
    planActual === planPorTipo(tipoAnterior) ? planPorTipo(tipoNuevo) : planActual;
  /**
   * El plan que queda al guardar el alta (paso 2), cuando la persona puede elegir cómo usar UNIDOAR: con el abono de su tipo (`abono`, o
   * `semestral`: el mismo abono pagado por adelantado) o pagando una sola búsqueda (`puntual`, solo si ese plan se sigue ofreciendo). Sin elección (`modalidad` ausente: la opción no se mostró) el plan
   * sigue al tipo como siempre.
   *  - Cuenta nueva (`actual` ausente): `puntual` si lo eligió; si no, el arancel de su tipo.
   *  - Cuenta que ya existe (vuelve al paso 2 antes de verificarse): pasa a `puntual` si lo eligió y estaba en el de su tipo (o ya en puntual);
   *    vuelve al arancel de su tipo si estaba en puntual y eligió el abono; y un plan que el equipo le asignó a mano (Multisede…) no se toca.
   */
  const planDelAlta = (e: {
    actual?: string;
    tipoAnterior?: string;
    tipo: string;
    modalidad?: "abono" | "semestral" | "puntual";
    /** Queda algún lugar de fundadora (`cuposDeFundador(...) > 0`): el abono de una cuenta nueva es el Plan Fundador en lugar del arancel de su tipo. */
    hayCupoFundador?: boolean;
  }): string => {
    // El abono con el que arranca quien no elige una sola búsqueda: las primeras instituciones, el Plan Fundador; el resto, el arancel de su tipo.
    const abonoInicial = (): string => (e.hayCupoFundador ? "fundador" : planPorTipo(e.tipo));
    const quierePuntual = e.modalidad === "puntual" && planes.puntual.vigente;
    if (e.actual === undefined) return quierePuntual ? "puntual" : abonoInicial();
    const eraPuntual = e.actual === "puntual";
    const eraElDeSuTipo = e.actual === planPorTipo(e.tipoAnterior ?? e.tipo);
    if (quierePuntual) return eraPuntual || eraElDeSuTipo || esFundador(e.actual) ? "puntual" : e.actual;
    // «semestral» es el mismo abono de su tipo, pagado por adelantado: para el plan cuenta igual que «abono».
    if ((e.modalidad === "abono" || e.modalidad === "semestral") && eraPuntual) return abonoInicial();
    return planTrasCambiarElTipo(e.actual, e.tipoAnterior ?? e.tipo, e.tipo);
  };

  /** Los tipos de cada arancel, para listarlos en la página de planes ("Otro" no se muestra: no le dice nada a quien decide). */
  const tiposPorPlan = {
    colegio: TIPOS_INSTITUCION.filter((t) => tiposColegio.includes(t)),
    deportiva: TIPOS_INSTITUCION.filter((t) => !tiposColegio.includes(t) && t !== "Otro"),
  };

  const esMultisede = (sedes: number) => sedes >= condiciones.sedesMultisede;
  /** Lo que paga por mes una red con N sedes. */
  const precioMultisede = (sedes: number) => planes.multisede.precio * Math.max(sedes, 1);

  /**
   * Lo que sale el pack por adelantado de un plan, con y sin referido. Con más de una sede (`sedes`), sobre lo que paga por mes
   * (`montoDePlan`: las sedes adicionales con su descuento): el semestre de una institución con 2 sedes son 5 veces su monto mensual.
   */
  const packDe = (clave: PlanClave, sedes = 1, acuerdo: AcuerdoDePrecio | null = null) => {
    const mensual = montoDePlan(clave, sedes, acuerdo);
    const { meses, mesesQueSePagan, mesesConReferido } = condiciones.pack;
    return { lista: mensual * meses, anticipado: mensual * mesesQueSePagan, conReferido: mensual * mesesConReferido };
  };

  /** Lo que va detrás del precio: "/mes" o " por búsqueda" (la búsqueda puntual no tiene abono). */
  const sufijoDePrecio = (clave: string) => {
    const p = planDe(clave);
    return p.periodo === "evento" ? " por búsqueda" : `/${p.periodo}`;
  };

  /** "$ 50.000/mes" · "$ 15.000/mes por sede" · "$ 110.000 por búsqueda" */
  const precioDePlan = (clave: string) => {
    const p = planDe(clave);
    return `${pesos(p.precio)}${sufijoDePrecio(clave)}${p.porSede ? " por sede" : ""}`;
  };

  /**
   * Lo que se le dice a una INSTITUCIÓN del precio de un plan (avisos, textos): el plan por sede (Multisede) es un convenio y no tiene un precio
   * de lista, así que se dice «a convenir» en lugar de su precio base, que es interno (la página pública hace lo mismo).
   */
  const precioParaLaInstitucion = (clave: string) => (planDe(clave).porSede ? "a convenir según el volumen" : precioDePlan(clave));

  /** Es el plan sin abono de búsqueda puntual: se paga cada búsqueda, no hay facturas mensuales ni débito. */
  const esPuntual = (clave: string) => planDe(clave).periodo === "evento";

  /**
   * Si el plan incluye un beneficio. Los planes con abono incluyen todo; la búsqueda puntual, solo lo que el equipo tilda en Planes
   * (difusión de cursos, buscador y base de profesionales: los «beneficios continuos»).
   */
  const incluye = (clave: string, beneficio: "cursos" | "buscador") =>
    !esPuntual(clave) || (beneficio === "cursos" ? condiciones.puntual.incluyeCursos : condiciones.puntual.incluyeBuscador);

  /**
   * El acuerdo de precio que rige para un plan: solo uno acordado para ESE plan. Si la institución cambió de plan después (o de tipo, y con él
   * de plan), el acuerdo viejo no se aplica al nuevo —cobraría por debajo del piso de Colegios un abono acordado en Clubes, o un convenio
   * mensual en una búsqueda puntual— y paga la lista hasta que el equipo acuerde otro precio. Un acuerdo sin plan anotado vale con cualquiera.
   */
  const acuerdoQueRige = (clave: string, acuerdo: AcuerdoDePrecio | null): AcuerdoDePrecio | null =>
    acuerdo && (acuerdo.plan == null || acuerdo.plan === (esClavePlan(clave) ? clave : "colegio")) ? acuerdo : null;
  /** ¿Rige este acuerdo con ese plan? (Para avisarle al equipo que uno quedó sin efecto.) */
  const rigeElAcuerdo = (clave: string, acuerdo: AcuerdoDePrecio) => acuerdoQueRige(clave, acuerdo) !== null;

  /**
   * El abono de la primera sede: el de lista o, si la institución tiene un abono acordado para este plan, ese. Un abono acordado nunca cobra
   * más que la lista: si la lista bajó por debajo de lo acordado, vale la lista.
   */
  const abonoDe = (clave: string, acuerdo: AcuerdoDePrecio | null = null) => {
    const lista = planDe(clave).precio;
    const a = acuerdoQueRige(clave, acuerdo);
    return a?.modalidad === "abono" ? Math.min(a.monto, lista) : lista;
  };

  /**
   * Lo que paga cada sede adicional (de la segunda en adelante): el abono (el de lista o el acordado) con el descuento de `descuentoSedeExtra`.
   * En un plan por sede (Multisede) cada sede paga el precio entero.
   */
  const precioDeSedeExtra = (clave: string, acuerdo: AcuerdoDePrecio | null = null) => {
    const abono = abonoDe(clave, acuerdo);
    return planDe(clave).porSede ? abono : Math.round((abono * (100 - condiciones.descuentoSedeExtra)) / 100);
  };

  /**
   * Lo que se factura por período. Con un convenio a medida ("total") es ese monto, sean cuantas sean las sedes. Si no: en un plan por sede
   * (Multisede) es el precio de una sede por la cantidad de sedes; en los demás, el abono (el de lista o el acordado) más cada sede adicional
   * con su descuento (`precioDeSedeExtra`). Nunca menos de una sede.
   */
  const montoDePlan = (clave: string, sedes = 1, acuerdo: AcuerdoDePrecio | null = null) => {
    const a = acuerdoQueRige(clave, acuerdo);
    if (a?.modalidad === "total") return a.monto;
    const n = Math.max(1, Math.floor(sedes));
    const abono = abonoDe(clave, a);
    return planDe(clave).porSede ? abono * n : abono + (n - 1) * precioDeSedeExtra(clave, a);
  };

  /** El monto explicado: la primera sede, las adicionales y el total. Para mostrarlo ("$ 48.000 + 2 sedes adicionales de $ 24.000"). */
  const desgloseDeMonto = (clave: string, sedes = 1, acuerdo: AcuerdoDePrecio | null = null) => {
    const a = acuerdoQueRige(clave, acuerdo);
    const n = Math.max(1, Math.floor(sedes));
    const convenio = a?.modalidad === "total";
    return {
      /** Cuántas sedes tiene en total. */
      sedes: n,
      /** Lo que paga la primera sede (en un plan por sede, el precio por sede). Con un convenio a medida, el total. */
      base: convenio ? a.monto : abonoDe(clave, a),
      adicionales: convenio || planDe(clave).porSede ? 0 : n - 1,
      /** Lo que paga cada sede adicional. */
      precioAdicional: convenio ? 0 : precioDeSedeExtra(clave, a),
      total: montoDePlan(clave, n, a),
      /** El monto es un convenio a medida (un total fijo), no un abono por sede. */
      convenio,
      /** Tiene un precio acordado (abono o convenio) que rige con este plan, en lugar del de lista. */
      acordado: !!a,
    };
  };

  /**
   * Entre qué valores puede estar un abono acordado: del piso del plan a su precio de lista. Sin piso, solo el de lista (el abono no se
   * negocia), así que el rango es un solo valor.
   */
  const rangoDeAbono = (clave: string) => {
    const p = planDe(clave);
    return { minimo: Math.min(p.precioMinimo ?? p.precio, p.precio), maximo: p.precio };
  };

  /** Por qué un precio acordado no se puede guardar (null si está bien): un abono tiene que caer dentro del rango del plan. */
  const errorDeAcuerdo = (clave: string, acuerdo: AcuerdoDePrecio): string | null => {
    if (!Number.isInteger(acuerdo.monto) || acuerdo.monto < 1 || acuerdo.monto > 10_000_000) return "Escribí un monto en pesos, entero y mayor que cero.";
    if (acuerdo.modalidad === "abono") {
      const { minimo, maximo } = rangoDeAbono(clave);
      if (acuerdo.monto < minimo || acuerdo.monto > maximo) {
        return minimo === maximo
          ? `Este plan no tiene un piso, así que el abono es el de lista (${pesos(maximo)}). Para otro monto usá un convenio a medida o cargá un precio mínimo en Planes.`
          : `El abono tiene que estar entre ${pesos(minimo)} y ${pesos(maximo)}, el rango del plan. Para otro monto usá un convenio a medida.`;
      }
    }
    return null;
  };

  /** "Plan Multisede" → "Multisede" (para tablas y filtros, donde "Plan" sobra). */
  const nombreDePlan = (clave: string) => planDe(clave).label.replace(/^Plan /, "");

  /**
   * ¿Hay un precio con el que facturar? Todos los planes tienen su precio de lista salvo Multisede (redes y cadenas): su valor se acuerda según el
   * volumen, o sea un convenio a medida (`total`) cargado desde la ficha de cobros. Sin ese convenio no se factura, no se debita y no entra en el
   * MRR: el precio por sede de Planes es una base interna que no escala de forma lineal (una red grande no paga la suma de sus sedes).
   */
  const precioDefinido = (clave: string, acuerdo: AcuerdoDePrecio | null = null) =>
    !planDe(clave).porSede || acuerdoQueRige(clave, acuerdo)?.modalidad === "total";

  /** Lo que aporta una institución al MRR: lo que paga por mes (un plan por sede, el precio por la cantidad de sedes). */
  const equivalenteMensual = (clave: string, sedes = 1, acuerdo: AcuerdoDePrecio | null = null) => {
    // La búsqueda puntual no es un ingreso recurrente: no entra en el MRR. Una red sin convenio todavía no paga nada.
    if (planDe(clave).periodo === "evento" || !precioDefinido(clave, acuerdo)) return 0;
    return montoDePlan(clave, sedes, acuerdo);
  };

  return {
    catalogo,
    planes,
    condiciones,
    planDe,
    vigentes,
    clavesParaElegir,
    planPorTipo,
    planesParaPedir,
    planTrasCambiarElTipo,
    planDelAlta,
    tiposPorPlan,
    esMultisede,
    precioMultisede,
    packDe,
    precioDePlan,
    precioParaLaInstitucion,
    rigeElAcuerdo,
    sufijoDePrecio,
    esPuntual,
    incluye,
    precioDeSedeExtra,
    abonoDe,
    montoDePlan,
    desgloseDeMonto,
    rangoDeAbono,
    errorDeAcuerdo,
    nombreDePlan,
    equivalenteMensual,
    precioDefinido,
    esFundador,
    cuposDeFundador,
    vigentesPublicos,
  };
}

export type Planes = ReturnType<typeof crearPlanes>;

/** Las reglas con los valores de lanzamiento: lo que usan las pruebas y, como respaldo, el servidor si la base no responde. */
export const planesPorDefecto: Planes = crearPlanes(CATALOGO_POR_DEFECTO);

/* ───────────────────────────── De la base al catálogo ───────────────────────────── */

export type FilaDePlan = {
  clave: string;
  etiqueta: string;
  precio: number;
  /** El piso del rango. `null`: sin piso, el abono no se negocia. Sin el dato (undefined) vale el de lanzamiento. */
  precioMinimo?: number | null;
  resumen: string;
  detalle: string;
  vigente: boolean;
};
export type FilaDeCondiciones = {
  sedesMultisede: number;
  /** Puede faltar en una base a la que todavía no se le agregó la columna: en ese caso vale el de lanzamiento. */
  descuentoSedeExtra?: number;
  /** Condiciones de la búsqueda puntual: pueden faltar en una base a la que todavía no se le agregaron las columnas (vale el de lanzamiento). */
  puntualVigenciaDias?: number;
  puntualBusquedasAbiertas?: number;
  puntualIncluyeCursos?: boolean;
  puntualIncluyeBuscador?: boolean;
  /** Meses bonificados por recomendación para quien paga mes a mes: puede faltar en una base sin la columna (vale el de lanzamiento). */
  referidoMesesMensual?: number;
  /** Cuántas instituciones fundadoras entran: puede faltar en una base sin la columna (vale el de lanzamiento). */
  cuposFundador?: number;
  packMeses: number;
  packMesesPagos: number;
  packMesesReferido: number;
  tiposColegio: string[];
};

const entero = (v: unknown, minimo: number, maximo: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= minimo && v <= maximo;

/**
 * Arma el catálogo con lo que hay en la base. Lo que falta o no tiene sentido (un precio en cero, un texto vacío, un pack sin meses
 * bonificados) se reemplaza, campo por campo, por el valor de lanzamiento: una fila rota nunca deja a la app sin precios.
 */
export function catalogoDesdeLaBase(filasDePlanes: readonly FilaDePlan[], condicionesGuardadas: FilaDeCondiciones | null | undefined): CatalogoDePlanes {
  const planes = { ...PLANES_POR_DEFECTO };
  for (const clave of CLAVES_PLAN) {
    const base = PLANES_POR_DEFECTO[clave];
    const fila = filasDePlanes.find((f) => f.clave === clave);
    if (!fila) continue;
    const precio = entero(fila.precio, 1, 10_000_000) ? fila.precio : base.precio;
    planes[clave] = {
      ...base,
      label: typeof fila.etiqueta === "string" && fila.etiqueta.trim() ? fila.etiqueta.trim() : base.label,
      precio,
      // Un piso que no tiene sentido (más alto que la lista) se descarta: sin piso, el abono no se negocia.
      precioMinimo: fila.precioMinimo === undefined ? base.precioMinimo : entero(fila.precioMinimo, 1, precio) ? fila.precioMinimo : null,
      resumen: typeof fila.resumen === "string" ? fila.resumen.trim() : base.resumen,
      detalle: typeof fila.detalle === "string" ? fila.detalle.trim() : base.detalle,
      vigente: typeof fila.vigente === "boolean" ? fila.vigente : base.vigente,
    };
  }

  const c = condicionesGuardadas;
  const defecto = CONDICIONES_POR_DEFECTO;
  const packValido = !!c && entero(c.packMeses, 2, MAX_MESES_DE_PACK) &&entero(c.packMesesPagos, 1, c.packMeses - 1) && entero(c.packMesesReferido, 1, c.packMesesPagos - 1);
  const condiciones: CondicionesDePlanes = {
    sedesMultisede: c && entero(c.sedesMultisede, 2, 100) ? c.sedesMultisede : defecto.sedesMultisede,
    descuentoSedeExtra: c && entero(c.descuentoSedeExtra, 0, 100) ? c.descuentoSedeExtra : defecto.descuentoSedeExtra,
    puntual: {
      vigenciaDias: c && entero(c.puntualVigenciaDias, 1, 365) ? c.puntualVigenciaDias : defecto.puntual.vigenciaDias,
      busquedasAbiertas: c && entero(c.puntualBusquedasAbiertas, 1, 20) ? c.puntualBusquedasAbiertas : defecto.puntual.busquedasAbiertas,
      incluyeCursos: c && typeof c.puntualIncluyeCursos === "boolean" ? c.puntualIncluyeCursos : defecto.puntual.incluyeCursos,
      incluyeBuscador: c && typeof c.puntualIncluyeBuscador === "boolean" ? c.puntualIncluyeBuscador : defecto.puntual.incluyeBuscador,
    },
    pack: packValido ? { meses: c.packMeses, mesesQueSePagan: c.packMesesPagos, mesesConReferido: c.packMesesReferido } : defecto.pack,
    referidoMesesMensual: c && entero(c.referidoMesesMensual, 0, 12) ? c.referidoMesesMensual : defecto.referidoMesesMensual,
    cuposFundador: c && entero(c.cuposFundador, 1, 1000) ? c.cuposFundador : defecto.cuposFundador,
    tiposColegio: c && Array.isArray(c.tiposColegio) && c.tiposColegio.length > 0 ? [...c.tiposColegio] : [...defecto.tiposColegio],
  };
  return { planes, condiciones };
}

/* ───────────────────────────── Lo que edita el backoffice ───────────────────────────── */

const texto = (min: number, max: number, que: string) =>
  z
    .string({ error: `Escribí ${que}.` })
    .trim()
    .min(min, min > 0 ? `Escribí ${que}.` : undefined)
    .max(max, `Máximo ${max} caracteres.`);

const edicionDePlanSchema = z.object({
  etiqueta: texto(3, 60, "el nombre del plan"),
  precio: z
    .number({ error: "Escribí el precio en pesos." })
    .int("El precio tiene que ser un número entero, sin centavos.")
    .min(1, "El precio tiene que ser mayor que cero.")
    .max(10_000_000, "Revisá el precio: es demasiado alto."),
  /** El piso del rango (null: sin piso, el abono no se negocia). */
  precioMinimo: z
    .number({ error: "Escribí el precio mínimo en pesos." })
    .int("El precio mínimo tiene que ser un número entero, sin centavos.")
    .min(1, "El precio mínimo tiene que ser mayor que cero.")
    .max(10_000_000, "Revisá el precio mínimo: es demasiado alto.")
    .nullable(),
  resumen: texto(0, 160, "el resumen"),
  detalle: texto(0, 300, "el detalle"),
  vigente: z.boolean(),
});

export type EdicionDePlan = z.infer<typeof edicionDePlanSchema>;

const numeroDePack = (min: number, max: number) =>
  z.number({ error: "Escribí un número." }).int("Tiene que ser un número entero.").min(min, `Mínimo ${min}.`).max(max, `Máximo ${max}.`);

/**
 * Lo que manda la pantalla "Planes" al guardar. Los precios y textos de los planes, si se ofrecen o no, y las condiciones.
 * Colegios y Clubes no se pueden dejar de ofrecer: son los dos que reciben las instituciones nuevas según su tipo (cuando no hay lugar de fundadora).
 */
export const edicionDePlanesSchema = z
  .object({
    planes: z.object(Object.fromEntries(CLAVES_PLAN.map((c) => [c, edicionDePlanSchema])) as Record<PlanClave, typeof edicionDePlanSchema>),
    condiciones: z.object({
      sedesMultisede: numeroDePack(2, 100),
      descuentoSedeExtra: numeroDePack(0, 100),
      referidoMesesMensual: numeroDePack(0, 12),
      cuposFundador: numeroDePack(1, 1000),
      puntual: z.object({
        vigenciaDias: numeroDePack(1, 365),
        busquedasAbiertas: numeroDePack(1, 20),
        incluyeCursos: z.boolean(),
        incluyeBuscador: z.boolean(),
      }),
      pack: z.object({
        meses: numeroDePack(2, MAX_MESES_DE_PACK),
        mesesQueSePagan: numeroDePack(1, MAX_MESES_DE_PACK),
        mesesConReferido: numeroDePack(1, MAX_MESES_DE_PACK),
      }),
      tiposColegio: z.array(z.enum(TIPOS_INSTITUCION)).min(1, "Elegí al menos un tipo de institución para el arancel de colegios."),
    }),
  })
  .superRefine((d, ctx) => {
    for (const clave of CLAVES_PLAN) {
      const { precio, precioMinimo } = d.planes[clave];
      if (precioMinimo !== null && precioMinimo > precio) {
        ctx.addIssue({ code: "custom", path: ["planes", clave, "precioMinimo"], message: "El mínimo no puede ser más alto que el precio de lista." });
      }
    }
    for (const clave of ["colegio", "deportiva"] as const) {
      if (!d.planes[clave].vigente) {
        ctx.addIssue({ code: "custom", path: ["planes", clave, "vigente"], message: "Este plan tiene que seguir ofreciéndose: lo reciben las instituciones nuevas según su tipo." });
      }
    }
    const { meses, mesesQueSePagan, mesesConReferido } = d.condiciones.pack;
    if (mesesQueSePagan >= meses) {
      ctx.addIssue({ code: "custom", path: ["condiciones", "pack", "mesesQueSePagan"], message: "Tienen que ser menos que los meses del pack: si no, no hay mes bonificado." });
    }
    if (mesesConReferido >= mesesQueSePagan) {
      ctx.addIssue({ code: "custom", path: ["condiciones", "pack", "mesesConReferido"], message: "Tienen que ser menos que los que se pagan sin referido: si no, recomendar no suma nada." });
    }
  });

export type EdicionDePlanes = z.infer<typeof edicionDePlanesSchema>;

/** Errores de la edición por ruta completa ("planes.colegio.precio"), para pintarlos junto a cada campo. */
export function camposDeErrorDePlanes(error: z.ZodError) {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) campos[issue.path.join(".") || "_"] ??= issue.message;
  return campos;
}

/**
 * Una huella de lo que había guardado cuando se abrió la pantalla: al guardar se compara con lo que hay ahora, y si otra persona del
 * equipo cambió algo mientras tanto no se pisa su trabajo.
 */
export const huellaDePlanes = (e: EdicionDePlanes) => JSON.stringify(e);

/** La edición que corresponde a un catálogo: lo que la pantalla muestra al abrir. */
export function edicionDesdeCatalogo(c: CatalogoDePlanes): EdicionDePlanes {
  return {
    planes: Object.fromEntries(
      CLAVES_PLAN.map((k) => {
        const { label, precio, precioMinimo, resumen, detalle, vigente } = c.planes[k];
        return [k, { etiqueta: label, precio, precioMinimo, resumen, detalle, vigente }];
      }),
    ) as EdicionDePlanes["planes"],
    condiciones: {
      sedesMultisede: c.condiciones.sedesMultisede,
      descuentoSedeExtra: c.condiciones.descuentoSedeExtra,
      referidoMesesMensual: c.condiciones.referidoMesesMensual,
      cuposFundador: c.condiciones.cuposFundador,
      puntual: { ...c.condiciones.puntual },
      pack: { ...c.condiciones.pack },
      tiposColegio: TIPOS_INSTITUCION.filter((t) => c.condiciones.tiposColegio.includes(t)),
    },
  };
}

const ETIQUETAS_DE_CAMPO: Record<keyof EdicionDePlan, string> = {
  etiqueta: "nombre",
  precio: "precio",
  precioMinimo: "precio mínimo",
  resumen: "resumen",
  detalle: "detalle",
  vigente: "si se ofrece",
};

/**
 * Qué cambió entre lo guardado y lo que se manda, para la auditoría y para mostrar "últimos cambios". Los precios llevan el valor
 * anterior y el nuevo (no son datos personales y es lo que alguien va a querer ver); de lo demás solo se anota qué se tocó.
 */
export type CambioDePlanes =
  | { tipo: "precio"; plan: PlanClave; antes: number; despues: number }
  | { tipo: "plan"; plan: PlanClave; campos: string[] }
  | { tipo: "condiciones"; campos: string[] };

export function cambiosDePlanes(antes: EdicionDePlanes, despues: EdicionDePlanes): CambioDePlanes[] {
  const cambios: CambioDePlanes[] = [];
  for (const clave of CLAVES_PLAN) {
    const a = antes.planes[clave];
    const d = despues.planes[clave];
    if (a.precio !== d.precio) cambios.push({ tipo: "precio", plan: clave, antes: a.precio, despues: d.precio });
    const otros = (["etiqueta", "precioMinimo", "resumen", "detalle", "vigente"] as const).filter((c) => a[c] !== d[c]);
    if (otros.length > 0) cambios.push({ tipo: "plan", plan: clave, campos: otros.map((c) => ETIQUETAS_DE_CAMPO[c]) });
  }
  const campos: string[] = [];
  if (antes.condiciones.sedesMultisede !== despues.condiciones.sedesMultisede) campos.push("sedes para el plan Multisede");
  if (antes.condiciones.descuentoSedeExtra !== despues.condiciones.descuentoSedeExtra) campos.push("descuento por sede adicional");
  if (antes.condiciones.referidoMesesMensual !== despues.condiciones.referidoMesesMensual) campos.push("meses bonificados por recomendación");
  if (antes.condiciones.cuposFundador !== despues.condiciones.cuposFundador) campos.push("cupos de instituciones fundadoras");
  const ua = antes.condiciones.puntual;
  const ud = despues.condiciones.puntual;
  if (ua.vigenciaDias !== ud.vigenciaDias || ua.busquedasAbiertas !== ud.busquedasAbiertas || ua.incluyeCursos !== ud.incluyeCursos || ua.incluyeBuscador !== ud.incluyeBuscador) {
    campos.push("condiciones de la búsqueda puntual");
  }
  const pa = antes.condiciones.pack;
  const pd = despues.condiciones.pack;
  if (pa.meses !== pd.meses || pa.mesesQueSePagan !== pd.mesesQueSePagan || pa.mesesConReferido !== pd.mesesConReferido) campos.push("pack por adelantado");
  const ta = [...antes.condiciones.tiposColegio].sort().join("|");
  const td = [...despues.condiciones.tiposColegio].sort().join("|");
  if (ta !== td) campos.push("tipos que pagan el arancel de colegios");
  if (campos.length > 0) cambios.push({ tipo: "condiciones", campos });
  return cambios;
}

/** Una línea legible de un cambio: "Plan Colegios · precio de $ 50.000 a $ 55.000". `nombreDe` da el nombre vigente del plan. */
export function describirCambioDePlanes(c: CambioDePlanes, nombreDe: (clave: PlanClave) => string) {
  if (c.tipo === "precio") return `${nombreDe(c.plan)} · precio de ${pesos(c.antes)} a ${pesos(c.despues)}`;
  if (c.tipo === "plan") return `${nombreDe(c.plan)} · ${c.campos.join(", ")}`;
  return `Condiciones · ${c.campos.join(", ")}`;
}

/** Los cambios que quedaron anotados en una entrada de auditoría (`{ cambios: [...] }`); lo que no tenga la forma esperada se ignora. */
export function cambiosDeAuditoria(detalle: unknown): CambioDePlanes[] {
  const lista = typeof detalle === "object" && detalle !== null ? (detalle as { cambios?: unknown }).cambios : null;
  if (!Array.isArray(lista)) return [];
  const textos = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");
  const cambios: CambioDePlanes[] = [];
  for (const c of lista) {
    if (typeof c !== "object" || c === null) continue;
    const { tipo, plan, antes, despues, campos } = c as Record<string, unknown>;
    if (tipo === "precio" && esClavePlan(plan) && typeof antes === "number" && typeof despues === "number") cambios.push({ tipo, plan, antes, despues });
    else if (tipo === "plan" && esClavePlan(plan) && textos(campos)) cambios.push({ tipo, plan, campos: campos as string[] });
    else if (tipo === "condiciones" && textos(campos)) cambios.push({ tipo, campos: campos as string[] });
  }
  return cambios;
}
