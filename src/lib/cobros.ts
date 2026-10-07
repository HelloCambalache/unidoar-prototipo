import { z } from "zod";
import { enlaceWhatsapp } from "@/lib/pipeline";
import { PLANES, pesos, planDe, type PlanClave } from "@/lib/planes";

/*
 * Reglas de cobros compartidas por el backoffice (servidor y cliente). Sin acceso a base.
 * Las fechas de cobro son columnas `date` ("2026-10-10"): se comparan como texto, en hora argentina.
 */

const ZONA = "America/Argentina/Buenos_Aires";

export const CLAVES_PLAN = Object.keys(PLANES) as [PlanClave, ...PlanClave[]];
export const esClavePlan = (v: unknown): v is PlanClave => typeof v === "string" && Object.hasOwn(PLANES, v);

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

/** Lo que aporta una institución al MRR: el anual cuenta como precio / 12. */
export function equivalenteMensual(plan: string) {
  const p = planDe(plan);
  return p.periodo === "año" ? Math.round(p.precio / 12) : p.precio;
}

/** "$ 54.000/mes" · "$ 720.000/año" */
export function precioDePlan(plan: string) {
  const p = planDe(plan);
  return `${pesos(p.precio)}/${p.periodo}`;
}

export const montoDePlan = (plan: string) => planDe(plan).precio;

/** "Plan Fundador" → "Fundador" (para tablas y filtros, donde "Plan" sobra). */
export const nombreDePlan = (plan: string) => planDe(plan).label.replace(/^Plan /, "");

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

export type InstitucionFacturable = { id: string; plan: string; diaCobro: number | null; medioPago: string | null };
/** Una factura ya existente de la institución, de los últimos 12 períodos (el actual incluido). */
export type FacturaReciente = { institucionId: string; periodo: string; plan: string; estado: string };
export type FacturaPorCrear = {
  institucionId: string;
  plan: PlanClave;
  monto: number;
  periodo: string;
  fechaCobro: string;
  medio: string | null;
};
export type MotivoOmision = "ya_tiene" | "anual_vigente" | "cubierta_por_anual" | "plan_desconocido";

/**
 * Qué facturas de `periodo` hay que crear. Mismas reglas que la carga manual y que el cambio de plan
 * (`aplicarPlanAlPeriodoActual`): una por institución y mes, nace pendiente, el monto sale del plan, y una factura
 * anual cubre los 12 meses desde su período. Sin acceso a base: `recientes` trae las facturas de los últimos 12 períodos.
 *
 *  - ya tiene factura de ese mes → no se toca;
 *  - plan anual: si ya hay una factura anual en la ventana (paga o por pagar) no se genera otra hasta que venza el año;
 *  - plan mensual: si una factura anual paga todavía cubre el mes, no se cobra;
 *  - si el día de cobro del mes ya pasó, se cobra hoy: no nace vencida.
 */
export function planificarFacturas(
  instituciones: InstitucionFacturable[],
  recientes: FacturaReciente[],
  periodo: string,
  hoy: string,
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
    else if (propias.some((f) => f.periodo === periodo)) omitir("ya_tiene");
    else if (inst.plan === "anual" && propias.some((f) => f.plan === "anual")) omitir("anual_vigente");
    else if (inst.plan !== "anual" && propias.some((f) => f.plan === "anual" && f.estado === "pagada")) {
      omitir("cubierta_por_anual");
    } else {
      const fecha = fechaCobroDelPeriodo(periodo, inst.diaCobro);
      crear.push({
        institucionId: inst.id,
        plan: inst.plan,
        monto: montoDePlan(inst.plan),
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
