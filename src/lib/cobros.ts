import { z } from "zod";
import { enlaceWhatsapp } from "@/lib/pipeline";
import { CLAVES_PLAN, esClavePlan, pesos, planesPorDefecto, type AcuerdoDePrecio, type PlanClave, type Planes } from "@/lib/planes";

// Las claves de plan son fijas (las referencian instituciones y facturas): se re-exportan acá porque los formularios de cobros las usan.
export { CLAVES_PLAN, esClavePlan };

/*
 * Reglas de cobros compartidas por el backoffice (servidor y cliente). Sin acceso a base.
 * Las fechas de cobro son columnas `date` ("2026-10-10"): se comparan como texto, en hora argentina.
 */

const ZONA = "America/Argentina/Buenos_Aires";

export const MEDIOS_PAGO = ["Transferencia", "Tarjeta", "Débito automático", "Efectivo", "Mercado Pago"] as const;

/** Día del mes en que se cobra cuando la institución no tiene uno cargado. */
export const DIA_COBRO_POR_DEFECTO = 10;

export type EstadoFactura = "pagada" | "pendiente" | "vencida";

const FORMATO_HOY = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

/** Hoy en Argentina, "2026-10-06". */
export const hoyAR = (ahora = new Date()) => FORMATO_HOY.format(ahora);
/** Mes en curso en Argentina, "2026-10". */
export const periodoActual = (ahora = new Date()) => hoyAR(ahora).slice(0, 7);
/** Año en curso en Argentina. */
export const anioActual = (ahora = new Date()) => Number(hoyAR(ahora).slice(0, 4));

/**
 * Una factura pendiente cuya fecha ya pasó cuenta como vencida aunque nadie la haya marcado: el estado
 * guardado solo se actualiza cuando el equipo usa "Marcar vencidas", así que se calcula al leer.
 */
export function estadoEfectivo(estado: string, fechaCobro: string, hoy: string): EstadoFactura {
  if (estado === "pagada") return "pagada";
  if (estado === "vencida") return "vencida";
  return fechaCobro < hoy ? "vencida" : "pendiente";
}

export const ETIQUETA_ESTADO_FACTURA: Record<EstadoFactura, string> = {
  pagada: "Pagado",
  pendiente: "Pendiente",
  vencida: "Vencido",
};

/** Estado de una institución en la tabla de cobros. */
export type EstadoCobro = "aldia" | "pendiente" | "vencida";
export const ETIQUETA_ESTADO_COBRO: Record<EstadoCobro, string> = {
  aldia: "Al día",
  pendiente: "Pendiente",
  vencida: "Vencida",
};

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** "2026-09" → "Septiembre 2026". */
export function etiquetaPeriodo(periodo: string) {
  const [anio, mes] = periodo.split("-");
  const nombre = MESES[Number(mes) - 1];
  return nombre && anio ? `${nombre} ${anio}` : periodo;
}

/** "2026-11" + 3 → "2027-02". */
export function sumarMeses(periodo: string, n: number) {
  const [anio, mes] = periodo.split("-").map(Number) as [number, number];
  const total = anio * 12 + (mes - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** "2026-10" + 10 → "2026-10-10" (el día se acota al largo del mes). */
export function fechaCobroDelPeriodo(periodo: string, dia?: number | null) {
  const [anio, mes] = periodo.split("-").map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const d = Math.min(Math.max(dia ?? DIA_COBRO_POR_DEFECTO, 1), ultimo);
  return `${periodo}-${String(d).padStart(2, "0")}`;
}

/** "2026-10-10" → "10/10/2026". */
export function fechaDeColumna(fecha: string) {
  const [anio, mes, dia] = fecha.split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
}

/** "2026-10-10" → "10 oct 2026". */
export function fechaBreve(fecha: string) {
  const [anio, mes, dia] = fecha.split("-");
  const nombre = MESES[Number(mes) - 1]?.slice(0, 3).toLowerCase();
  return anio && nombre && dia ? `${Number(dia)} ${nombre} ${anio}` : fecha;
}

/* ───────────────────────────── Semestre al contado ─────────────────────────────
   Una factura paga puede cubrir varios meses (`facturas.meses_cubiertos`): el semestre pagado por adelantado (pagás 5, usás 6) es UNA factura
   que cubre 6 meses desde su período y no deja facturas para los siguientes, igual que la anual cubre 12. Acá viven las reglas puras. */

/** Una factura con lo que hace falta para saber qué meses cubre. Sin `mesesCubiertos`, cubre solo su mes. */
export type FacturaConCobertura = { periodo: string; estado: string; mesesCubiertos?: number | null };

/** Último mes que cubre una factura: el suyo si es mensual; "2027-03" para un semestre que empieza en "2026-10". */
export const ultimoMesCubierto = (f: Pick<FacturaConCobertura, "periodo" | "mesesCubiertos">) =>
  sumarMeses(f.periodo, Math.max(1, f.mesesCubiertos ?? 1) - 1);

/**
 * Hasta qué mes está pago `periodo`, mirando solo facturas PAGAS (la de ese mes o un semestre que lo cubre), o null si ninguna lo cubre.
 * Con varias, el que llega más lejos. Los meses son "AAAA-MM", así que se comparan como texto.
 */
export function pagoHastaDeMes(periodo: string, facturas: readonly FacturaConCobertura[]): string | null {
  let hasta: string | null = null;
  for (const f of facturas) {
    if (f.estado !== "pagada" || f.periodo > periodo) continue;
    const fin = ultimoMesCubierto(f);
    if (fin >= periodo && (!hasta || fin > hasta)) hasta = fin;
  }
  return hasta;
}

/** "Septiembre 2026" para una factura mensual; "6 meses (octubre 2026 a marzo 2027)" para un semestre. */
export function etiquetaDeCobertura(periodo: string, meses?: number | null) {
  const n = Math.max(1, meses ?? 1);
  if (n === 1) return etiquetaPeriodo(periodo);
  const bajo = (p: string) => etiquetaPeriodo(p).toLowerCase();
  return `${n} meses (${bajo(periodo)} a ${bajo(sumarMeses(periodo, n - 1))})`;
}

/**
 * Qué impide registrar un semestre que empieza en `inicio` y cubre `meses` meses: meses de esa ventana que ya están pagos (propios o cubiertos
 * por otro semestre) y facturas impagas adentro (salvo la del primer mes, que se convierte en la del semestre). Lista de meses, sin repetir.
 */
export function conflictosDeSemestre(inicio: string, meses: number, facturas: readonly FacturaConCobertura[]) {
  const fin = sumarMeses(inicio, meses - 1);
  const pagos = new Set<string>();
  const impagas = new Set<string>();
  for (const f of facturas) {
    if (f.periodo > fin || ultimoMesCubierto(f) < inicio) continue;
    if (f.estado === "pagada") pagos.add(f.periodo);
    else if (f.periodo !== inicio) impagas.add(f.periodo);
  }
  return { pagos: [...pagos].sort(), impagas: [...impagas].sort() };
}

/**
 * El mes en que empieza un semestre se puede elegir de hace un año a dentro de dos meses (cubre un pago que se cargó tarde o uno por
 * adelantado, no un error de tipeo). Devuelve el mensaje de error o null si está bien.
 */
export function errorDeInicioDeSemestre(inicio: string, actual: string) {
  if (inicio < sumarMeses(actual, -11)) return "Revisá el mes: es de hace más de un año.";
  if (inicio > sumarMeses(actual, 2)) return "El semestre no puede empezar dentro de más de dos meses.";
  return null;
}

/** wa.me con el texto ya escrito. Null si el teléfono no se reconoce como argentino. */
export function enlaceWhatsappConTexto(telefono: string | null | undefined, texto: string) {
  const base = enlaceWhatsapp(telefono);
  return base ? `${base}?text=${encodeURIComponent(texto)}` : null;
}

type CobroPendiente = { periodo: string; monto: number; fechaCobro: string };

/** Texto prellenado del recordatorio de cobro. La persona lo revisa y lo manda a mano desde WhatsApp. */
export function textoRecordatorio(contacto: string | null, institucion: string, pendientes: CobroPendiente[]) {
  const saludo = contacto ? `Hola ${contacto.split(" ")[0]}, ` : "Hola, ";
  const firma = "Si ya lo pagaste, avisanos así lo registramos. ¡Gracias!";
  if (pendientes.length === 0) {
    return `${saludo}te escribimos de UNIDOAR por la suscripción de ${institucion}. Está todo al día, gracias.`;
  }
  if (pendientes.length === 1) {
    const [c] = pendientes as [CobroPendiente];
    return `${saludo}te escribimos de UNIDOAR. Te recordamos que está pendiente el pago de ${etiquetaPeriodo(c.periodo)} de ${institucion} (${pesos(c.monto)}), con vencimiento el ${fechaDeColumna(c.fechaCobro)}. ${firma}`;
  }
  const total = pendientes.reduce((s, c) => s + c.monto, 0);
  const periodos = pendientes.map((c) => etiquetaPeriodo(c.periodo)).join(", ");
  return `${saludo}te escribimos de UNIDOAR. De ${institucion} quedan ${pendientes.length} cobros pendientes (${periodos}) por un total de ${pesos(total)}. Si ya pagaste alguno, avisanos así lo registramos. ¡Gracias!`;
}

/* ───────── Facturas automáticas ───────── */

export type InstitucionFacturable = {
  id: string;
  plan: string;
  diaCobro: number | null;
  medioPago: string | null;
  /** Cuántas sedes tiene (cuenta en un plan por sede como Multisede; sin dato, una). */
  sedes?: number;
  /** El precio acordado con ella (abono o convenio), si tiene uno; sin acuerdo paga el de lista. */
  acuerdo?: AcuerdoDePrecio | null;
};
/** Una factura ya existente de la institución, de los últimos 12 períodos (el actual incluido). */
export type FacturaReciente = { institucionId: string; periodo: string; plan: string; estado: string; mesesCubiertos?: number | null };
export type FacturaPorCrear = {
  institucionId: string;
  plan: PlanClave;
  monto: number;
  periodo: string;
  fechaCobro: string;
  medio: string | null;
};
export type MotivoOmision = "ya_tiene" | "anual_vigente" | "cubierta_por_anual" | "cubierta_por_semestre" | "sin_abono" | "plan_desconocido";

/**
 * Qué facturas de `periodo` hay que crear. Mismas reglas que la carga manual y que el cambio de plan
 * (`aplicarPlanAlPeriodoActual`): una por institución y mes, nace pendiente, el monto sale del plan, y una factura
 * anual cubre los 12 meses desde su período. Sin acceso a base: `recientes` trae las facturas de los últimos 12 períodos.
 *
 *  - plan de búsqueda puntual: no tiene abono mensual, nunca se factura;
 *  - ya tiene factura de ese mes → no se toca;
 *  - plan anual: si ya hay una factura anual en la ventana (paga o por pagar) no se genera otra hasta que venza el año;
 *  - plan mensual: si una factura anual paga todavía cubre el mes, no se cobra;
 *  - si un semestre pagado al contado (una factura paga que cubre varios meses) cubre el mes, no se cobra;
 *  - si el día de cobro del mes ya pasó, se cobra hoy: no nace vencida.
 */
export function planificarFacturas(
  instituciones: InstitucionFacturable[],
  recientes: FacturaReciente[],
  periodo: string,
  hoy: string,
  /** Los planes vigentes (de dónde salen el monto y si se cobra por sede); sin pasarlos, los valores de lanzamiento. */
  planes: Planes = planesPorDefecto,
): { crear: FacturaPorCrear[]; omitidas: { institucionId: string; motivo: MotivoOmision }[] } {
  const porInstitucion = new Map<string, FacturaReciente[]>();
  for (const f of recientes) {
    const lista = porInstitucion.get(f.institucionId) ?? [];
    lista.push(f);
    porInstitucion.set(f.institucionId, lista);
  }

  const crear: FacturaPorCrear[] = [];
  const omitidas: { institucionId: string; motivo: MotivoOmision }[] = [];
  for (const inst of instituciones) {
    const propias = porInstitucion.get(inst.id) ?? [];
    const omitir = (motivo: MotivoOmision) => omitidas.push({ institucionId: inst.id, motivo });

    if (!esClavePlan(inst.plan)) omitir("plan_desconocido");
    // La búsqueda puntual no tiene abono: se paga cada búsqueda (ver src/lib/puntual.ts), así que no hay factura mensual.
    else if (planes.esPuntual(inst.plan)) omitir("sin_abono");
    else if (propias.some((f) => f.periodo === periodo)) omitir("ya_tiene");
    else if (inst.plan === "anual" && propias.some((f) => f.plan === "anual")) omitir("anual_vigente");
    else if (inst.plan !== "anual" && propias.some((f) => f.plan === "anual" && f.estado === "pagada")) {
      omitir("cubierta_por_anual");
    } else if (pagoHastaDeMes(periodo, propias.filter((f) => (f.mesesCubiertos ?? 1) > 1))) {
      omitir("cubierta_por_semestre");
    } else {
      const fecha = fechaCobroDelPeriodo(periodo, inst.diaCobro);
      crear.push({
        institucionId: inst.id,
        plan: inst.plan,
        // En un plan por sede (Multisede), el precio de una sede por las sedes que tiene la institución.
        monto: planes.montoDePlan(inst.plan, inst.sedes, inst.acuerdo),
        periodo,
        fechaCobro: fecha < hoy ? hoy : fecha,
        medio: inst.medioPago,
      });
    }
  }
  return { crear, omitidas };
}

/* ───────── Esquemas de formularios (los reusan cliente y server actions) ───────── */

const vacioAUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

const esFechaReal = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const facturaNuevaSchema = z.object({
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Elegí el mes que se cobra"),
  plan: z.enum(CLAVES_PLAN, { error: "Elegí un plan" }),
  fechaCobro: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha de cobro")
    .refine(esFechaReal, "La fecha no existe"),
  medio: vacioAUndefined(z.enum(MEDIOS_PAGO).optional()),
});
export type FacturaNueva = z.input<typeof facturaNuevaSchema>;

/** Hasta cuántos días atrás se puede registrar un pago (cubre un cierre de año o un olvido largo, no un error de tipeo). */
export const DIAS_MAXIMOS_PAGO_ATRASADO = 366;

/**
 * Reglas de la fecha en la que llegó el pago ("2026-10-03"), en hora argentina: no puede ser futura ni de hace más de
 * un año. Devuelve el mensaje de error o null si está bien. Las usan el formulario y la acción del servidor.
 */
export function errorDeFechaDePago(fecha: string, hoy: string) {
  if (fecha > hoy) return "La fecha del pago no puede ser futura.";
  const dias = (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${fecha}T00:00:00Z`)) / 86_400_000;
  if (dias > DIAS_MAXIMOS_PAGO_ATRASADO) return "Revisá la fecha: es de hace más de un año.";
  return null;
}

export const pagoSchema = z.object({
  medio: z.enum(MEDIOS_PAGO, { error: "Elegí el medio de pago" }),
  /** Cuándo llegó el pago; sin fecha se toma el momento del registro. */
  fecha: vacioAUndefined(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha del pago")
      .refine(esFechaReal, "La fecha no existe")
      .optional(),
  ),
});

/**
 * Pago en efectivo en un solo paso (sin tener que cargar antes la factura). El mes puede ya tener una factura impaga, y entonces
 * se registra sobre ella (con su monto), o no tenerla, y entonces se crea ya paga con el monto del plan elegido. El monto
 * nunca viene del cliente. La nota es optativa (por ejemplo el número de recibo).
 */
export const pagoEfectivoSchema = z.object({
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Elegí el mes que se paga"),
  plan: z.enum(CLAVES_PLAN, { error: "Elegí un plan" }),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha del pago")
    .refine(esFechaReal, "La fecha no existe"),
  nota: vacioAUndefined(z.string().trim().max(120, "Máximo 120 caracteres").optional()),
  /** Si se le avisa a la institución (campanita y mail) que se registró su pago. */
  avisar: z.boolean(),
});
export type PagoEfectivo = z.input<typeof pagoEfectivoSchema>;

/** Cómo se paga un semestre: al contado y por adelantado, en mano o por transferencia (no hay débito: Mercado Pago cobra mes a mes). */
export const MEDIOS_SEMESTRE = ["Efectivo", "Transferencia"] as const;

/**
 * Semestre al contado: la institución paga por adelantado los meses del pack (pagás 5, usás 6) y se registra UNA factura paga que los cubre
 * desde `periodo`. El monto y los meses salen del plan de la institución y del pack del catálogo (nunca del cliente).
 */
export const semestreSchema = z.object({
  /** Mes en que empieza el semestre ("2026-10"). */
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Elegí el mes en que empieza"),
  medio: z.enum(MEDIOS_SEMESTRE, { error: "Elegí cómo pagó" }),
  /** Cuándo llegó el pago. */
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha del pago")
    .refine(esFechaReal, "La fecha no existe"),
  nota: vacioAUndefined(z.string().trim().max(120, "Máximo 120 caracteres").optional()),
  /** Si se le avisa a la institución (campanita y mail) que se registró su pago. */
  avisar: z.boolean(),
  /** Si tiene un débito automático vivo, se cancela antes de registrar (si no, Mercado Pago le cobraría los meses que ya pagó). */
  cancelarDebito: z.boolean(),
});
export type SemestreAlContado = z.input<typeof semestreSchema>;

/** Cómo se paga una búsqueda puntual: por adelantado y de una vez (no hay débito: no es una suscripción). */
export const MEDIOS_PUNTUAL = ["Transferencia", "Efectivo", "Mercado Pago", "Tarjeta"] as const;

/**
 * Pago de una búsqueda puntual (el plan sin abono): el equipo lo registra y la institución queda con una búsqueda pagada para publicar. El monto
 * sale del plan de búsqueda puntual y del precio acordado de la institución, nunca del cliente.
 */
export const pagoPuntualSchema = z.object({
  medio: z.enum(MEDIOS_PUNTUAL, { error: "Elegí cómo pagó" }),
  /** Cuándo llegó el pago. */
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha del pago")
    .refine(esFechaReal, "La fecha no existe"),
  nota: vacioAUndefined(z.string().trim().max(120, "Máximo 120 caracteres").optional()),
  /** Si se le avisa a la institución (campanita y mail) que se registró su pago. */
  avisar: z.boolean(),
});
export type PagoPuntual = z.input<typeof pagoPuntualSchema>;

/** Qué hay de un mes en la facturación de una institución: ya pago, con la factura impaga, o sin factura. */
export type SituacionDelMes = "pagada" | "impaga" | "sinFactura";
export const situacionDelMes = (factura: { estado: string } | null | undefined): SituacionDelMes =>
  !factura ? "sinFactura" : factura.estado === "pagada" ? "pagada" : "impaga";

export const anulacionSchema = z.object({
  motivo: z.string().trim().min(3, "Contá el motivo: queda en el registro del equipo").max(300, "Máximo 300 caracteres"),
  /** Si se le avisa a la institución que el pago registrado se corrigió. */
  avisar: z.boolean(),
});

export const rechazoSchema = z.object({
  nota: z.string().trim().min(3, "Contale a la institución por qué").max(500, "Máximo 500 caracteres"),
});

export const aprobacionSchema = z.object({
  nota: vacioAUndefined(z.string().trim().max(500, "Máximo 500 caracteres").optional()),
});
