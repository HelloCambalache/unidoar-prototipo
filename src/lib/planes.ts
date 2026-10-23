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
 * Los planes marcados `vigente: false` son los que vendíamos antes. Siguen acá porque las facturas guardan la clave del plan al
 * momento del cobro (`facturas.plan`) y hay cuentas que todavía los tienen: sin ellos, una factura vieja no sabría qué nombre ni qué
 * precio mostrar. No se ofrecen a nadie nuevo. Las claves son fijas (no se crean ni se borran planes desde el backoffice): una
 * factura o una institución las referencian.
 */

/** Cada cuánto se cobra un plan: por mes, por año o por evento (la búsqueda puntual: se paga cada búsqueda, sin abono). */
export type Periodo = "mes" | "año" | "evento";

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

export const CLAVES_PLAN = ["colegio", "deportiva", "multisede", "fundador", "estandar", "anual", "puntual"] as const;
export type PlanClave = (typeof CLAVES_PLAN)[number];

export const esClavePlan = (v: unknown): v is PlanClave => typeof v === "string" && (CLAVES_PLAN as readonly string[]).includes(v);

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
export type AcuerdoDePrecio = { modalidad: "abono" | "total"; monto: number };

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
    resumen: "Para redes de 5 sedes o más: el precio es por sede.",
    detalle: "Desde la quinta sede se factura por sede, no por institución.",
    vigente: true,
    porSede: true,
  },
  fundador: {
    label: "Plan Fundador",
    precio: 54_000,
    precioMinimo: null,
    periodo: "mes",
    resumen: "Búsquedas ilimitadas. Precio fijo mientras sigas suscripto.",
    detalle: "Plan anterior: precio congelado para las instituciones que entraron en el lanzamiento.",
    vigente: false,
    porSede: false,
  },
  estandar: {
    label: "Plan Estándar",
    precio: 89_000,
    precioMinimo: null,
    periodo: "mes",
    resumen: "Búsquedas ilimitadas.",
    detalle: "Plan anterior: precio de lista único, antes de separar por tipo de institución.",
    vigente: false,
    porSede: false,
  },
  anual: {
    label: "Plan Anual",
    precio: 720_000,
    precioMinimo: null,
    periodo: "año",
    resumen: "Búsquedas ilimitadas, pago anual.",
    detalle: "Plan anterior: dos meses bonificados pagando el año completo por adelantado.",
    vigente: false,
    porSede: false,
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
};

export const CONDICIONES_POR_DEFECTO: CondicionesDePlanes = {
  sedesMultisede: 5,
  descuentoSedeExtra: 50,
  pack: { meses: 6, mesesQueSePagan: 5, mesesConReferido: 4 },
  referidoMesesMensual: 2,
  puntual: { vigenciaDias: 30, busquedasAbiertas: 1, incluyeCursos: false, incluyeBuscador: false },
  tiposColegio: ["Colegio privado", "Colegio público", "Jardín de infantes", "Instituto terciario", "Universidad"],
};

export const CATALOGO_POR_DEFECTO: CatalogoDePlanes = { planes: PLANES_POR_DEFECTO, condiciones: CONDICIONES_POR_DEFECTO };

export const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

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
   * El plan que le toca a una institución cuando cambia su tipo. Solo se mueve si el plan que tiene era el que le correspondía por su tipo
   * anterior (el que se le asignó solo al crearla): uno que el equipo cambió a mano (Multisede, Fundador…) no se toca. Sin esto, alguien
   * podía elegir "Otro" (arancel deportivo), cambiar después a "Colegio" antes de verificarse y quedarse con el plan más barato.
   */
  const planTrasCambiarElTipo = (planActual: string, tipoAnterior: string, tipoNuevo: string): string =>
    planActual === planPorTipo(tipoAnterior) ? planPorTipo(tipoNuevo) : planActual;

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

  /** Lo que va detrás del precio: "/mes", "/año" o " por búsqueda" (la búsqueda puntual no tiene abono). */
  const sufijoDePrecio = (clave: string) => {
    const p = planDe(clave);
    return p.periodo === "evento" ? " por búsqueda" : `/${p.periodo}`;
  };

  /** "$ 50.000/mes" · "$ 15.000/mes por sede" · "$ 110.000 por búsqueda" */
  const precioDePlan = (clave: string) => {
    const p = planDe(clave);
    return `${pesos(p.precio)}${sufijoDePrecio(clave)}${p.porSede ? " por sede" : ""}`;
  };

  /** Es el plan sin abono de búsqueda puntual: se paga cada búsqueda, no hay facturas mensuales ni débito. */
  const esPuntual = (clave: string) => planDe(clave).periodo === "evento";

  /**
   * Si el plan incluye un beneficio. Los planes con abono incluyen todo; la búsqueda puntual, solo lo que el equipo tilda en Planes
   * (difusión de cursos, buscador y base de profesionales: los «beneficios continuos»).
   */
  const incluye = (clave: string, beneficio: "cursos" | "buscador") =>
    !esPuntual(clave) || (beneficio === "cursos" ? condiciones.puntual.incluyeCursos : condiciones.puntual.incluyeBuscador);

  /**
   * El abono de la primera sede: el de lista o, si la institución tiene un abono acordado, ese. Un abono acordado nunca cobra más que la lista:
   * si el plan cambió o la lista bajó por debajo de lo acordado, vale la lista (la ficha avisa que el acuerdo quedó fuera de rango).
   */
  const abonoDe = (clave: string, acuerdo: AcuerdoDePrecio | null = null) => {
    const lista = planDe(clave).precio;
    return acuerdo?.modalidad === "abono" ? Math.min(acuerdo.monto, lista) : lista;
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
    if (acuerdo?.modalidad === "total") return acuerdo.monto;
    const n = Math.max(1, Math.floor(sedes));
    const abono = abonoDe(clave, acuerdo);
    return planDe(clave).porSede ? abono * n : abono + (n - 1) * precioDeSedeExtra(clave, acuerdo);
  };

  /** El monto explicado: la primera sede, las adicionales y el total. Para mostrarlo ("$ 48.000 + 2 sedes adicionales de $ 24.000"). */
  const desgloseDeMonto = (clave: string, sedes = 1, acuerdo: AcuerdoDePrecio | null = null) => {
    const n = Math.max(1, Math.floor(sedes));
    const convenio = acuerdo?.modalidad === "total";
    return {
      /** Cuántas sedes tiene en total. */
      sedes: n,
      /** Lo que paga la primera sede (en un plan por sede, el precio por sede). Con un convenio a medida, el total. */
      base: convenio ? acuerdo.monto : abonoDe(clave, acuerdo),
      adicionales: convenio || planDe(clave).porSede ? 0 : n - 1,
      /** Lo que paga cada sede adicional. */
      precioAdicional: convenio ? 0 : precioDeSedeExtra(clave, acuerdo),
      total: montoDePlan(clave, n, acuerdo),
      /** El monto es un convenio a medida (un total fijo), no un abono por sede. */
      convenio,
      /** Tiene un precio acordado (abono o convenio) en lugar del de lista. */
      acordado: !!acuerdo,
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

  /** "Plan Fundador" → "Fundador" (para tablas y filtros, donde "Plan" sobra). */
  const nombreDePlan = (clave: string) => planDe(clave).label.replace(/^Plan /, "");

  /** Lo que aporta una institución al MRR: el anual cuenta como precio / 12 y un plan por sede, el precio por la cantidad de sedes. */
  const equivalenteMensual = (clave: string, sedes = 1, acuerdo: AcuerdoDePrecio | null = null) => {
    const p = planDe(clave);
    // La búsqueda puntual no es un ingreso recurrente: no entra en el MRR.
    if (p.periodo === "evento") return 0;
    const monto = montoDePlan(clave, sedes, acuerdo);
    return p.periodo === "año" ? Math.round(monto / 12) : monto;
  };

  return {
    catalogo,
    planes,
    condiciones,
    planDe,
    vigentes,
    clavesParaElegir,
    planPorTipo,
    planTrasCambiarElTipo,
    tiposPorPlan,
    esMultisede,
    precioMultisede,
    packDe,
    precioDePlan,
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
  const packValido = !!c && entero(c.packMeses, 2, 24) && entero(c.packMesesPagos, 1, c.packMeses - 1) && entero(c.packMesesReferido, 1, c.packMesesPagos - 1);
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
 * Lo que manda la pantalla "Planes" al guardar. Los precios y textos de los seis planes, si se ofrecen o no, y las condiciones.
 * Colegios y Clubes no se pueden dejar de ofrecer: son los dos que reciben las instituciones nuevas según su tipo.
 */
export const edicionDePlanesSchema = z
  .object({
    planes: z.object(Object.fromEntries(CLAVES_PLAN.map((c) => [c, edicionDePlanSchema])) as Record<PlanClave, typeof edicionDePlanSchema>),
    condiciones: z.object({
      sedesMultisede: numeroDePack(2, 100),
      descuentoSedeExtra: numeroDePack(0, 100),
      referidoMesesMensual: numeroDePack(0, 12),
      puntual: z.object({
        vigenciaDias: numeroDePack(1, 365),
        busquedasAbiertas: numeroDePack(1, 20),
        incluyeCursos: z.boolean(),
        incluyeBuscador: z.boolean(),
      }),
      pack: z.object({ meses: numeroDePack(2, 24), mesesQueSePagan: numeroDePack(1, 24), mesesConReferido: numeroDePack(1, 24) }),
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
