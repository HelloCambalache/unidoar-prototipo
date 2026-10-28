import "server-only";
import { eq } from "drizzle-orm";
import { claveDePostulantes, sumarDias, type Recordatorio } from "./claves";
import { encolarParaUsuarios } from "./cola";
import { facturas, type EtapaPostulacion } from "@/db/schema";
import { etiquetaDeCobertura, etiquetaPeriodo, fechaBreve, hoyAR } from "@/lib/cobros";
import { numeroDeComprobante, rutaDeComprobante } from "@/lib/facturacion";
import { DIAS_DE_GRACIA, type AvisoDeMora } from "@/lib/mora";
import { pesos } from "@/lib/planes";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { planes } from "@/lib/queries/planes";

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

/**
 * M35: el profesional respondió la entrevista («Voy» o «No puedo»). Un mail por respuesta distinta de cada entrevista: la clave lleva el
 * momento agendado y lo que respondió, así que reprogramarla o cambiar de idea avisa de nuevo, pero apretar el mismo botón dos veces
 * no repite el mail. Le llega a quienes tienen acceso a la institución, igual que el aviso de la campanita.
 */
export async function correoDeRespuestaDeEntrevista(
  ejecutor: Ejecutor,
  d: {
    usuarioIds: string[];
    postulacionId: string;
    busquedaId: string;
    puesto: string;
    profesional: string;
    respuesta: "voy" | "no_puedo";
    cuando: Date;
    cuandoTexto: string;
    mensaje: string | null;
  },
) {
  await encolarParaUsuarios(
    ejecutor,
    d.usuarioIds,
    "M35",
    {
      profesional: d.profesional,
      puesto: d.puesto,
      respuesta: d.respuesta,
      cuando: d.cuandoTexto,
      mensaje: d.mensaje,
      ruta: `/institucion/postulantes?busqueda=${d.busquedaId}`,
    },
    { clave: () => `M35:${d.postulacionId}:${d.cuando.getTime()}:${d.respuesta}` },
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
    await encolarParaUsuarios(
      ejecutor,
      d.usuarioIds,
      "M52",
      { ...datos, vencio: fechaBreve(d.fechaCobro), segundoAviso: r.segundoAviso, ultimoDiaDeGracia: fechaBreve(sumarDias(d.fechaCobro, DIAS_DE_GRACIA)) },
      { clave: () => r.clave },
    );
  }
}

/**
 * M68: la mora (ver src/lib/mora.ts). `previo` es el último aviso (quedan pocos días de gracia) y `limitada` avisa que la cuenta quedó limitada. La clave
 * (factura y etapa) hace que cada uno salga una sola vez aunque la tarea corra todos los días.
 */
export async function correoDeMora(ejecutor: Ejecutor, a: AvisoDeMora, d: Factura & { fechaCobro: string }) {
  await encolarParaUsuarios(
    ejecutor,
    d.usuarioIds,
    "M68",
    {
      institucion: d.institucion,
      limitada: a.etapa === "limitada",
      periodo: etiquetaPeriodo(d.periodo),
      monto: pesos(d.monto),
      vencio: fechaBreve(d.fechaCobro),
      ultimoDiaDeGracia: fechaBreve(sumarDias(d.fechaCobro, DIAS_DE_GRACIA)),
    },
    { clave: () => a.clave },
  );
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

/**
 * Los datos del comprobante de una factura ya pagada, para el mail: lo mismo que muestra la hoja de la app (`/institucion/plan/facturas/<id>`). Se lee
 * con el mismo ejecutor que registró el pago (dentro de su transacción): ve la factura ya marcada paga, con su medio y su fecha.
 */
async function datosDelComprobante(ejecutor: Ejecutor, facturaId: string) {
  const [f] = await ejecutor.select({ plan: facturas.plan, medio: facturas.medio, pagadaEn: facturas.pagadaEn }).from(facturas).where(eq(facturas.id, facturaId)).limit(1);
  if (!f) return null;
  return {
    numero: numeroDeComprobante(facturaId),
    plan: (await planes()).planDe(f.plan).label,
    medio: f.medio,
    pagadoEl: fechaBreve(hoyAR(f.pagadaEn ?? new Date())),
    ruta: rutaDeComprobante(facturaId),
  };
}

/**
 * M53: se registró el pago, lo haya cargado el equipo (factura impaga, efectivo o semestre) o lo haya cobrado el débito automático de Mercado Pago.
 * Con `facturaId` el mail es el **comprobante**: lleva sus datos (N.º, plan, período, monto, medio y fecha de pago) y el enlace a la hoja de la app;
 * sin él (la compra de una búsqueda puntual, que no es una factura) es solo el aviso. Con `mesesCubiertos` > 1 (un semestre al contado) el período
 * se cuenta como tal: "6 meses (octubre 2026 a marzo 2027)".
 */
export async function correoDePagoRegistrado(ejecutor: Ejecutor, d: Factura & { mesesCubiertos?: number; concepto?: string; facturaId?: string }) {
  const comprobante = d.facturaId ? await datosDelComprobante(ejecutor, d.facturaId) : null;
  await encolarParaUsuarios(ejecutor, d.usuarioIds, "M53", {
    institucion: d.institucion,
    // `concepto` reemplaza al período cuando lo que se pagó no es un mes (una búsqueda puntual): "una búsqueda puntual".
    periodo: d.concepto ?? etiquetaDeCobertura(d.periodo, d.mesesCubiertos),
    monto: pesos(d.monto),
    ...(comprobante ? { comprobante } : {}),
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
