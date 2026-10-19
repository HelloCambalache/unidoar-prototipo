import { z } from "zod";
import { MENSAJE_CUIT, TIPOS_INSTITUCION } from "@/lib/catalogo";
import { CLAVES_PLAN, esClavePlan, etiquetaPeriodo } from "@/lib/cobros";
import { esCuitValido, formatearCuit } from "@/lib/documentos";
import { planesPorDefecto, type PlanClave, type Planes } from "@/lib/planes";

/* Filtros y vocabularios del backoffice de instituciones. Sin acceso a base: los usa también el cliente. */

export const POR_PAGINA_INSTITUCIONES = 25;

export type OrdenInstituciones = "nombre" | "busquedas" | "recientes";
export type EstadoInstitucion = "activa" | "suspendida" | "vencida" | "baja";
export type VerificacionFiltro = "si" | "no";

export type FiltrosInstituciones = {
  q: string;
  tipo: string;
  plan: PlanClave | "";
  verificacion: VerificacionFiltro | "";
  estado: EstadoInstitucion | "";
  orden: OrdenInstituciones;
  pagina: number;
};

export const ESTADOS_INSTITUCION: { clave: EstadoInstitucion; etiqueta: string }[] = [
  { clave: "activa", etiqueta: "Activas" },
  { clave: "suspendida", etiqueta: "Suspendidas" },
  { clave: "vencida", etiqueta: "Con pago vencido" },
  { clave: "baja", etiqueta: "Dadas de baja" },
];

export const ORDENES_INSTITUCIONES: { clave: OrdenInstituciones; etiqueta: string }[] = [
  { clave: "nombre", etiqueta: "Nombre A–Z" },
  { clave: "busquedas", etiqueta: "Más búsquedas activas" },
  { clave: "recientes", etiqueta: "Más recientes" },
];

export const MOTIVOS_SUSPENSION = [
  "Falta de pago",
  "Incumplimiento de términos",
  "Lo pidió la institución",
  "Otro",
] as const;

/**
 * Datos de la cuenta que el equipo puede corregir y que la institución no edita sola (teléfono de contacto y CUIT: se cargan en el
 * alta; el CUE es de cada sede y se carga en el editor de sedes). Vacío los deja sin dato; el teléfono, si se pone, tiene que ser
 * usable, y el CUIT tiene que ser un CUIT real (se guarda con guiones: es el que sale en las facturas).
 */
export const datosDeCuentaSchema = z.object({
  telefono: z
    .string()
    .trim()
    .max(40, "Máximo 40 caracteres")
    .refine((v) => v === "" || v.length >= 6, "Poné un teléfono completo (mínimo 6 caracteres)")
    .transform((v) => (v ? v : null)),
  cuit: z
    .string()
    .trim()
    .max(20, "Máximo 20 caracteres")
    .refine((v) => v === "" || esCuitValido(v), MENSAJE_CUIT)
    .transform((v) => (v ? formatearCuit(v) : null)),
});
export type DatosDeCuenta = z.infer<typeof datosDeCuentaSchema>;

export const ROL_MIEMBRO: Record<string, string> = {
  dueno: "Dueño/a",
  administrador: "Administrador/a",
  colaborador: "Colaborador/a",
};

/** " · nombre, dirección": lo que tocó el equipo (solo los nombres de los campos, nunca los valores). */
const listaDeCampos = (campos: unknown) => {
  const nombres = Array.isArray(campos) ? campos.filter((c): c is string => typeof c === "string") : [];
  return nombres.length > 0 ? ` · ${nombres.join(", ")}` : "";
};

/** Una línea legible para el registro de actividad de la ficha ("Cambió el plan de Fundador a Estándar"). */
export function describirAccion(accion: string, detalle: Record<string, unknown> | null, planes: Planes = planesPorDefecto) {
  const d = detalle ?? {};
  const nombreDePlan = planes.nombreDePlan;
  const texto = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  switch (accion) {
    case "institucion.verificar":
      return "Verificó la institución";
    case "institucion.quitar_verificacion":
      return "Quitó la verificación";
    case "institucion.editar_perfil":
      return `Editó el perfil público${listaDeCampos(d.campos)}`;
    case "institucion.editar_datos":
      return `Editó los datos de la cuenta${listaDeCampos(d.campos)}`;
    case "institucion.editar_sedes":
      return `Editó las sedes${listaDeCampos(d.campos)}`;
    case "institucion.cambiar_plan":
      return `Cambió el plan${texto("de") ? ` de ${nombreDePlan(texto("de")!)}` : ""}${texto("a") ? ` a ${nombreDePlan(texto("a")!)}` : ""}`;
    case "institucion.suspender":
      return `Suspendió la cuenta${texto("motivo") ? ` · ${texto("motivo")}` : ""}`;
    case "institucion.reactivar":
      return "Reactivó la cuenta";
    case "referido.beneficio_aplicado":
      return `Aplicó el beneficio de referidos${texto("nombre") ? ` por recomendar a ${texto("nombre")}` : ""}`;
    case "referido.beneficio_deshecho":
      return `Deshizo el beneficio de referidos${texto("nombre") ? ` por recomendar a ${texto("nombre")}` : ""}`;
    case "cuenta.baja_solicitada":
      return "Pidió la baja de la cuenta";
    case "cuenta.baja_retirada":
      return "Retiró el pedido de baja";
    case "cuenta.baja_procesada":
      return "Procesó la baja: se borraron los datos y quedó el registro fiscal";
    case "cuenta.baja_incompleta":
      return "La baja quedó incompleta: falta borrar archivos o usuarios de acceso a mano";
    case "plan.aprobar":
      return `Aprobó el pedido de cambio de plan${texto("a") ? ` a ${nombreDePlan(texto("a")!)}` : ""}`;
    case "plan.rechazar":
      return "Rechazó un pedido de cambio de plan";
    case "factura.crear":
      return `Cargó la factura de ${texto("periodo") ? etiquetaPeriodo(texto("periodo")!) : "un período"}`;
    case "factura.pagar":
      return `Registró el pago de ${texto("periodo") ? etiquetaPeriodo(texto("periodo")!) : "una factura"}${texto("medio") ? ` · ${texto("medio")}` : ""}${texto("nota") ? ` · ${texto("nota")}` : ""}`;
    case "factura.anular_pago":
      return `Anuló el pago de ${texto("periodo") ? etiquetaPeriodo(texto("periodo")!) : "una factura"}${texto("motivo") ? ` · ${texto("motivo")}` : ""}`;
    case "factura.marcar_vencida":
      return `Marcó como vencida la factura de ${texto("periodo") ? etiquetaPeriodo(texto("periodo")!) : "un período"}`;
    default:
      return accion;
  }
}

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Lee y sanea los filtros de la URL: lo que no se reconoce se ignora. */
export function leerFiltrosInstituciones(sp: Record<string, string | string[] | undefined>): FiltrosInstituciones {
  const plan = uno(sp.plan);
  const verificacion = uno(sp.verificacion);
  const estado = uno(sp.estado);
  const orden = uno(sp.orden);
  const pagina = Number.parseInt(uno(sp.pagina), 10);
  const tipo = uno(sp.tipo);
  return {
    q: uno(sp.q).trim().slice(0, 80),
    tipo: (TIPOS_INSTITUCION as readonly string[]).includes(tipo) ? tipo : "",
    plan: esClavePlan(plan) ? plan : "",
    verificacion: verificacion === "si" || verificacion === "no" ? verificacion : "",
    estado: ESTADOS_INSTITUCION.some((e) => e.clave === estado) ? (estado as EstadoInstitucion) : "",
    orden: ORDENES_INSTITUCIONES.some((o) => o.clave === orden) ? (orden as OrdenInstituciones) : "nombre",
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** Querystring de la lista con los filtros vigentes (para paginar sin perder el filtrado). */
export function hrefInstituciones(f: FiltrosInstituciones, pagina: number) {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.tipo) params.set("tipo", f.tipo);
  if (f.plan) params.set("plan", f.plan);
  if (f.verificacion) params.set("verificacion", f.verificacion);
  if (f.estado) params.set("estado", f.estado);
  if (f.orden !== "nombre") params.set("orden", f.orden);
  if (pagina > 1) params.set("pagina", String(pagina));
  const qs = params.toString();
  return qs ? `/backoffice/instituciones?${qs}` : "/backoffice/instituciones";
}

/* ───────── Esquemas de las acciones ───────── */

export const planInstitucionSchema = z.object({ plan: z.enum(CLAVES_PLAN, { error: "Elegí un plan" }) });

export const suspensionSchema = z.object({
  motivo: z.enum(MOTIVOS_SUSPENSION, { error: "Elegí el motivo" }),
  nota: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .transform((v) => v || undefined),
});
