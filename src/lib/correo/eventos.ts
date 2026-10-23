import "server-only";
import { claveDePostulantes, type Recordatorio } from "./claves";
import { encolarParaUsuarios } from "./cola";
import type { EtapaPostulacion } from "@/db/schema";
import { etiquetaDeCobertura, etiquetaPeriodo, fechaBreve } from "@/lib/cobros";
import { pesos } from "@/lib/planes";
import type { Ejecutor } from "@/lib/queries/pipeline";

/*
 * Un mail por cada cosa que pasa en el producto. Las acciones llaman a estas funciones en lugar de armar los datos y
 * las claves ellas mismas: acá se decide a quién le llega cada uno, qué dice y cuántas veces puede repetirse.
 * Todas corren dentro de la transacción de la acción (ver cola.ts) y respetan las preferencias de la persona al enviar.
 */

const enlaceDePostulacion = (postulacionId: string) => `/docente/postulaciones?abrir=${postulacionId}`;
const unico = (usuarioId: string | null | undefined) => (usuarioId ? [usuarioId] : []);

type Postulacion = { usuarioId: string | null; institucion: string; puesto: string; postulacionId: string };

/* ───────────────────────────── Para el docente ───────────────────────────── */

/** M20: la institución lo invitó a postularse. Como máximo 5 por día por persona, inviten las instituciones que inviten (el tope se cuenta al enviar). */
export async function correoDeInvitacion(
  ejecutor: Ejecutor,
  d: { usuarioId: string | null; institucion: string; puesto: string; busquedaId: string },
) {
  await encolarParaUsuarios(
    ejecutor,
    unico(d.usuarioId),
    "M20",
    { institucion: d.institucion, puesto: d.puesto, ruta: `/docente/oferta/${d.busquedaId}` },
    { topeClave: (id) => `M20:${id}` },
  );
}

/** M21: salió una búsqueda rápida que encaja. Como máximo 3 por día por persona (el tope se cuenta al enviar). */
export async function correoDeBusquedaUrgente(
  ejecutor: Ejecutor,
  d: { usuarioIds: string[]; institucion: string; puesto: string; zona: string | null; plazo: string | null; busquedaId: string },
) {
  await encolarParaUsuarios(
    ejecutor,
    d.usuarioIds,
    "M21",
    { institucion: d.institucion, puesto: d.puesto, zona: d.zona, plazo: d.plazo, ruta: `/docente/oferta/${d.busquedaId}` },
    { topeClave: (id) => `M21:${id}` },
  );
}

/** M23 y M26: cambió de etapa. Una vez por postulación y etapa, aunque la muevan de un lado a otro. Archivar no manda nada (a propósito). */
export async function correoDeEtapa(ejecutor: Ejecutor, etapa: EtapaPostulacion, d: Postulacion) {
  const plantilla = etapa === "preseleccionados" ? "M23" : etapa === "oferta" ? "M26" : null;
  if (!plantilla) return;
  await encolarParaUsuarios(
    ejecutor,
    unico(d.usuarioId),
    plantilla,
    { institucion: d.institucion, puesto: d.puesto, ruta: enlaceDePostulacion(d.postulacionId) },
    { clave: () => `${plantilla}:${d.postulacionId}` },
  );
}

/** M27: lo contrataron. */
export async function correoDeContratacion(ejecutor: Ejecutor, d: Postulacion & { inicio: string | null }) {
  await encolarParaUsuarios(
    ejecutor,
    unico(d.usuarioId),
    "M27",
    { institucion: d.institucion, puesto: d.puesto, inicio: d.inicio, ruta: enlaceDePostulacion(d.postulacionId) },
    { clave: () => `M27:${d.postulacionId}` },
  );
}

/** M24: entrevista agendada. Si la reprograman a otra hora llega otro mail (la clave incluye el momento). */
export async function correoDeEntrevista(ejecutor: Ejecutor, d: Postulacion & { cuando: Date; cuandoTexto: string; titulo: string | null }) {
  await encolarParaUsuarios(
    ejecutor,
    unico(d.usuarioId),
    "M24",
    { institucion: d.institucion, puesto: d.puesto, cuando: d.cuandoTexto, titulo: d.titulo, ruta: enlaceDePostulacion(d.postulacionId) },
    { clave: () => `M24:${d.postulacionId}:${d.cuando.getTime()}` },
  );
}

/** M25: entrevista cancelada. */
export async function correoDeEntrevistaCancelada(ejecutor: Ejecutor, d: Postulacion & { cuando: Date }) {
  await encolarParaUsuarios(
    ejecutor,
    unico(d.usuarioId),
    "M25",
    { institucion: d.institucion, puesto: d.puesto, ruta: enlaceDePostulacion(d.postulacionId) },
    { clave: () => `M25:${d.postulacionId}:${d.cuando.getTime()}` },
  );
}

/* ───────────────────────────── Para la institución ───────────────────────────── */

/** M30: hay postulantes nuevos. Uno por búsqueda por día (por hora en las rápidas), a quienes tienen acceso a la institución. */
export async function correoDePostulantes(
  ejecutor: Ejecutor,
  d: { usuarioIds: string[]; busquedaId: string; puesto: string; rapida: boolean },
) {
  const clave = claveDePostulantes(d.busquedaId, d.rapida);
  await encolarParaUsuarios(
    ejecutor,
    d.usuarioIds,
    "M30",
    { busqueda: d.puesto, rapida: d.rapida, ruta: `/institucion/postulantes?busqueda=${d.busquedaId}` },
    { clave: () => clave },
  );
}

/* ───────────────────────────── Facturación y plan (a quienes administran la institución) ───────────────────────────── */

type Factura = { usuarioIds: string[]; institucion: string; periodo: string; monto: number };

/** M50: hay una factura nueva. Una vez por factura y persona. */
export async function correoDeFacturaNueva(ejecutor: Ejecutor, d: Factura & { facturaId: string; fechaCobro: string }) {
  await encolarParaUsuarios(
    ejecutor,
    d.usuarioIds,
    "M50",
    { institucion: d.institucion, periodo: etiquetaPeriodo(d.periodo), monto: pesos(d.monto), vence: fechaBreve(d.fechaCobro) },
    { clave: () => `M50:${d.facturaId}` },
  );
}

/** M51 y M52: recordatorio de una factura (lo decide `planificarRecordatorios`; la clave evita repetirlo). */
export async function correoDeRecordatorio(ejecutor: Ejecutor, r: Recordatorio, d: Factura & { fechaCobro: string }) {
  const datos = { institucion: d.institucion, periodo: etiquetaPeriodo(d.periodo), monto: pesos(d.monto) };
  if (r.plantilla === "M51") {
    await encolarParaUsuarios(ejecutor, d.usuarioIds, "M51", { ...datos, vence: fechaBreve(d.fechaCobro) }, { clave: () => r.clave });
  } else {
    await encolarParaUsuarios(ejecutor, d.usuarioIds, "M52", { ...datos, vencio: fechaBreve(d.fechaCobro), segundoAviso: r.segundoAviso }, { clave: () => r.clave });
  }
}

/**
 * M58: Mercado Pago no pudo cobrar el débito automático. Una vez por cobro y persona (la clave lleva el número del cobro en Mercado Pago):
 * los reintentos del mismo cobro no repiten el mail, avisan en la campanita.
 */
export async function correoDeCobroRechazado(ejecutor: Ejecutor, d: Factura & { cobroId: string }) {
  await encolarParaUsuarios(
    ejecutor,
    d.usuarioIds,
    "M58",
    { institucion: d.institucion, periodo: etiquetaPeriodo(d.periodo), monto: pesos(d.monto) },
    { clave: () => `M58:${d.cobroId}` },
  );
}

/** M53: el equipo registró el pago. Con `mesesCubiertos` > 1 (un semestre al contado) lo cuenta como tal: "6 meses (octubre 2026 a marzo 2027)". */
export async function correoDePagoRegistrado(ejecutor: Ejecutor, d: Factura & { mesesCubiertos?: number }) {
  await encolarParaUsuarios(ejecutor, d.usuarioIds, "M53", {
    institucion: d.institucion,
    periodo: etiquetaDeCobertura(d.periodo, d.mesesCubiertos),
    monto: pesos(d.monto),
  });
}

/** M54: el equipo anuló un pago registrado (solo si pidió avisarle a la institución). */
export async function correoDePagoAnulado(ejecutor: Ejecutor, d: Factura) {
  await encolarParaUsuarios(ejecutor, d.usuarioIds, "M54", { institucion: d.institucion, periodo: etiquetaPeriodo(d.periodo), monto: pesos(d.monto) });
}

/** M55: recibimos el pedido de cambio de plan (para quien lo pidió). `plan` ya viene con el nombre corto (`nombreDePlan`). */
export async function correoDePedidoDePlanRecibido(ejecutor: Ejecutor, d: { usuarioId: string; institucion: string; plan: string }) {
  await encolarParaUsuarios(ejecutor, [d.usuarioId], "M55", { institucion: d.institucion, plan: d.plan });
}

/** M56: el equipo aprobó o rechazó el pedido de cambio de plan. `plan` ya viene con el nombre corto (`nombreDePlan`). */
export async function correoDeResolucionDePlan(
  ejecutor: Ejecutor,
  d: { usuarioIds: string[]; institucion: string; plan: string; aprobado: boolean; nota: string | null; detalle: string | null },
) {
  await encolarParaUsuarios(ejecutor, d.usuarioIds, "M56", {
    institucion: d.institucion,
    plan: d.plan,
    aprobado: d.aprobado,
    nota: d.nota,
    detalle: d.detalle,
  });
}
