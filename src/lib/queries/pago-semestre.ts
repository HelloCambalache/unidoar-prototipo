import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, transaccion, type Tx } from "@/db";
import { instituciones, pagosSemestreMp, type PagoSemestreMp } from "@/db/schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { esUuid } from "@/lib/busquedas";
import { creditoDeSemestre, etiquetaDeCobertura, hoyAR, periodoActual, sumarMeses } from "@/lib/cobros";
import { suscripcionVigente } from "@/lib/debito-automatico";
import { resumenDeError } from "@/lib/errores";
import { puedePagarSemestre } from "@/lib/forma-de-pago";
import { buscarPagosDeReferenciaMp, crearPreferenciaMp, ErrorDeMercadoPago } from "@/lib/mercadopago-cliente";
import { mercadoPagoActivo, RUTA_DEL_WEBHOOK } from "@/lib/mercadopago-config";
import {
  cuerpoDePreferencia,
  decidirPagoDeSemestre,
  DIAS_DE_VIGENCIA_DEL_LINK,
  DIAS_PARA_RECUPERAR_UN_PAGO,
  elegirInicioDeSemestre,
  leerPagoMp,
  MEDIO_DE_PAGO_SEMESTRE,
  montoDelSemestre,
  tituloDelPago,
  type PagoLeido,
} from "@/lib/pago-semestre";
import { esClavePlan, pesos, type PlanClave } from "@/lib/planes";
import { origenDeLosMails } from "@/lib/correo/config";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { avisarAAdmins } from "@/lib/queries/avisos";
import type { EjecutorBo } from "@/lib/queries/backoffice-instituciones";
import { disponiblesPorInstitucion, mesesBonificadosSinCobro, periodosBonificadosDe } from "@/lib/queries/bonificaciones";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { planesParaCobrarOFallar, SIN_PRECIOS } from "@/lib/queries/planes";
import { avisarReferidorDePago } from "@/lib/queries/referidos";
import { cantidadDeSedes } from "@/lib/queries/sedes";
import { facturasDelSemestre, registrarSemestre } from "@/lib/queries/semestre";
import { suscripcionDe } from "@/lib/queries/suscripcion";
import { cancelarSuscripcion } from "@/lib/queries/suscripcion-cancelar";

/*
 * El semestre por adelantado pagado por Mercado Pago, de punta a punta (reglas puras en src/lib/pago-semestre.ts; ver «Pago del semestre por Mercado
 * Pago» en CLAUDE.md). La institución pide su link, paga en Mercado Pago y, cuando el pago se aprueba, se registra el semestre con el mismo núcleo que
 * usa el equipo (`registrarSemestre`). Lo que cuenta es lo que Mercado Pago contesta al preguntarle por el pago, nunca lo que dice el aviso.
 */

const MENSAJE_SIN_MERCADO_PAGO = "El pago por Mercado Pago todavía no está disponible. Escribinos desde Contacto y coordinamos el pago del semestre.";

/* ───────────────────────────── Cuánto sale y desde cuándo ───────────────────────────── */

export type Cotizacion =
  | {
      ok: true;
      plan: PlanClave;
      planLabel: string;
      /** El mes en que empieza el semestre ("AAAA-MM"). */
      inicio: string;
      meses: number;
      mesesAPagar: number;
      /** Pesos que se pagan. */
      monto: number;
      /** El semestre gasta un mes bonificado por recomendar (se paga un mes menos). */
      usaMesBonificado: boolean;
      /** "6 meses (octubre 2026 a marzo 2027)" */
      cobertura: string;
    }
  | { ok: false; error: string };

/**
 * Cuánto sale el semestre que se paga ahora y desde qué mes cubre: la misma cuenta que hace el equipo al registrarlo (plan, sedes, precio acordado,
 * pack de Planes y mes bonificado por recomendar), siempre calculada en el servidor. Si no se puede (plan sin abono, meses ya pagos, facturas sin pagar
 * adentro, un mes bonificado que habría que confirmar) devuelve el motivo.
 */
export async function cotizarSemestre(institucionId: string, ejecutor: EjecutorBo = getDb()): Promise<Cotizacion> {
  const P = await planesParaCobrarOFallar();
  if (!P) return { ok: false, error: SIN_PRECIOS };
  const [inst] = await ejecutor.select({ plan: instituciones.plan }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);
  if (!inst) return { ok: false, error: "No encontramos tu institución." };
  if (!esClavePlan(inst.plan) || !puedePagarSemestre(P, inst.plan)) {
    return { ok: false, error: "El pago por semestre es para los planes con abono mensual. Si lo necesitás, escribinos desde Contacto." };
  }
  const acuerdo = await acuerdoDe(ejecutor, institucionId);
  if (!P.precioDefinido(inst.plan, acuerdo)) return { ok: false, error: "Tu plan se acuerda con el equipo: escribinos desde Contacto para coordinar el pago." };

  const { meses } = P.condiciones.pack;
  const actual = periodoActual();
  // Las facturas desde antes del mes en curso hasta el final de la ventana más lejana en la que podría empezar el semestre.
  const facturas = await facturasDelSemestre(ejecutor, institucionId, sumarMeses(actual, 2), meses);
  const inicio = elegirInicioDeSemestre({ actual, meses, facturas });
  if ("error" in inicio) return { ok: false, error: inicio.error };

  // Un mes bonificado por recomendar adentro de la ventana hay que confirmarlo con el equipo (no se le puede cobrar sin avisarle): no se arma solo.
  const ventana = Array.from({ length: meses }, (_, k) => sumarMeses(inicio.inicio, k));
  if ((await mesesBonificadosSinCobro(ejecutor, institucionId, ventana)).length > 0) {
    return { ok: false, error: "Hay un mes bonificado por recomendar dentro de esos meses. Escribinos desde Contacto y armamos el pago del semestre con el equipo." };
  }

  const disponibles = (await disponiblesPorInstitucion(ejecutor, [institucionId])).get(institucionId) ?? 0;
  const usados = await periodosBonificadosDe(ejecutor, institucionId);
  const usaMesBonificado = creditoDeSemestre(inicio.inicio, meses, { disponibles, usados }).usa;
  const sedes = (await cantidadDeSedes(ejecutor, [institucionId])).get(institucionId) ?? 1;
  const mensual = P.montoDePlan(inst.plan, sedes, acuerdo);
  const { mesesAPagar, monto } = montoDelSemestre(mensual, usaMesBonificado, P.condiciones.pack);
  if (!Number.isInteger(monto) || monto <= 0) return { ok: false, error: "No pudimos calcular el monto del semestre. Escribinos desde Contacto." };

  return {
    ok: true,
    plan: inst.plan,
    planLabel: P.planDe(inst.plan).label,
    inicio: inicio.inicio,
    meses,
    mesesAPagar,
    monto,
    usaMesBonificado,
    cobertura: etiquetaDeCobertura(inicio.inicio, meses),
  };
}

/* ───────────────────────────── Armar el link de pago ───────────────────────────── */

const unDia = 24 * 60 * 60 * 1000;

/**
 * Crea el link de pago del semestre de una institución (Checkout Pro) y devuelve la dirección de Mercado Pago a la que hay que mandar a la persona.
 * El que llama ya comprobó que es dueño o administrador. Si ya hay un link vigente por lo mismo (mismo mes, mismo monto) se reutiliza: así tocar el
 * botón varias veces no deja varios links que se puedan pagar por duplicado. Nada de lo que se paga viene del navegador.
 */
export async function prepararPagoDeSemestre(inst: { id: string; nombre: string }, usuarioId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!mercadoPagoActivo()) return { ok: false, error: MENSAJE_SIN_MERCADO_PAGO };
  const cot = await cotizarSemestre(inst.id);
  if (!cot.ok) return cot;

  const db = getDb();
  // Un link anterior que sigue vigente por el mismo semestre se reutiliza (se deja un día de margen para que no venza mientras la persona paga).
  const [vigente] = await db
    .select()
    .from(pagosSemestreMp)
    .where(
      and(
        eq(pagosSemestreMp.institucionId, inst.id),
        eq(pagosSemestreMp.estado, "pendiente"),
        eq(pagosSemestreMp.periodo, cot.inicio),
        eq(pagosSemestreMp.monto, cot.monto),
        gte(pagosSemestreMp.creadoEn, new Date(Date.now() - (DIAS_DE_VIGENCIA_DEL_LINK - 1) * unDia)),
      ),
    )
    .orderBy(desc(pagosSemestreMp.creadoEn))
    .limit(1);
  if (vigente?.enlace) return { ok: true, url: vigente.enlace };

  const [intento] = await db
    .insert(pagosSemestreMp)
    .values({
      institucionId: inst.id,
      plan: cot.plan,
      periodo: cot.inicio,
      meses: cot.meses,
      mesesAPagar: cot.mesesAPagar,
      monto: cot.monto,
      usaMesBonificado: cot.usaMesBonificado,
    })
    .returning({ id: pagosSemestreMp.id });
  if (!intento) return { ok: false, error: "No pudimos armar el pago. Probá de nuevo en un momento." };

  try {
    // La dirección pública del sitio (la misma que usa el débito automático para volver de Mercado Pago).
    const origen = origenDeLosMails();
    const preferencia = await crearPreferenciaMp(
      cuerpoDePreferencia({
        referencia: intento.id,
        titulo: tituloDelPago(cot.planLabel, cot.inicio, cot.meses),
        descripcion: `Semestre por adelantado de ${inst.nombre}: se pagan ${cot.mesesAPagar} meses de ${cot.meses}.`,
        monto: cot.monto,
        origen,
        rutaDelAviso: RUTA_DEL_WEBHOOK,
      }),
    );
    if (!preferencia.enlace) throw new ErrorDeMercadoPago("no-disponible", "Mercado Pago no devolvió una dirección de pago válida.");
    await db.update(pagosSemestreMp).set({ preferenciaId: preferencia.id, enlace: preferencia.enlace, actualizadoEn: new Date() }).where(eq(pagosSemestreMp.id, intento.id));
    await registrarAuditoria({
      usuarioId,
      accion: "semestre.enlace_de_pago",
      entidad: "institucion",
      entidadId: inst.id,
      detalle: { intentoId: intento.id, periodo: cot.inicio, monto: cot.monto, mesesAPagar: cot.mesesAPagar, usaMesBonificado: cot.usaMesBonificado },
    });
    return { ok: true, url: preferencia.enlace };
  } catch (e) {
    // Sin link no hay nada que pagar: el intento no sirve y se borra (nadie pagó nada todavía).
    await db.delete(pagosSemestreMp).where(eq(pagosSemestreMp.id, intento.id)).catch(() => undefined);
    console.error("No se pudo crear el link de pago del semestre", resumenDeError(e));
    return { ok: false, error: "No pudimos armar el pago en Mercado Pago. Probá de nuevo en un momento o escribinos desde Contacto." };
  }
}

/* ───────────────────────────── Un pago que avisa Mercado Pago ───────────────────────────── */

export type ResultadoDelPago = "registrado" | "repetido" | "esperando" | "revisar" | "devuelto" | "sin-intento";

/** Un aviso al equipo con el enlace a la ficha de cobros de la institución. */
async function avisarAlEquipo(ejecutor: Ejecutor, institucionId: string, titulo: string, texto: string) {
  const [inst] = await ejecutor.select({ nombre: instituciones.nombre }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);
  await avisarAAdmins(ejecutor, { titulo, texto: `${inst?.nombre ?? "Una institución"}: ${texto}`, enlace: `/backoffice/cobros/${institucionId}` });
}

/**
 * Lo que pasa adentro de la transacción cuando llega un pago de Mercado Pago: se bloquea el intento, se vuelve a decidir con lo que hay en este momento y,
 * si corresponde, se registra el semestre. Separada de plicarPagoDeSemestre para poder probarla con una transacción que se deshace.
 */
export async function aplicarPagoEnTransaccion(tx: Tx, intentoId: string, pago: PagoLeido, debitoCancelado: boolean): Promise<ResultadoDelPago> {
  const [bloqueado] = await tx.select().from(pagosSemestreMp).where(eq(pagosSemestreMp.id, intentoId)).limit(1).for("update");
  if (!bloqueado) return "sin-intento";
  const decision = decidirPagoDeSemestre({ intento: bloqueado, pago });
  if (decision.accion === "ya-registrado") return "repetido";
  if (decision.accion === "esperar") return "esperando";

  // Un semestre que ya está registrado (`pagado`) NO cambia de estado por una devolución o un segundo pago: la factura sigue paga hasta que el
  // equipo decida (anular el pago en Cobros) y el intento tiene que seguir diciendo `pagado`, para que un aviso repetido no lo registre de nuevo.
  if (decision.accion === "devuelto") {
    await avisarAlEquipo(tx, bloqueado.institucionId, "Pago de semestre devuelto", `Mercado Pago informa que se devolvió el pago ${pago.id} del semestre (${pesos(bloqueado.monto)}), que ya estaba registrado. Revisar si hay que anular el pago en Cobros.`);
    return "devuelto";
  }
  if (decision.accion === "revisar") {
    if (bloqueado.estado !== "pagado") {
      await tx.update(pagosSemestreMp).set({ estado: "revisar", pagoId: bloqueado.pagoId ?? pago.id, actualizadoEn: new Date() }).where(eq(pagosSemestreMp.id, bloqueado.id));
    }
    await avisarAlEquipo(tx, bloqueado.institucionId, "Pago de semestre para revisar", `Mercado Pago aprobó el pago ${pago.id} del semestre y no se registró solo. ${decision.motivo}`);
    return "revisar";
  }

  const P = await planesParaCobrarOFallar();
  // Sin los precios vigentes no se registra (la factura sale con precios que no son): se lanza y Mercado Pago vuelve a avisar.
  if (!P) throw new Error(SIN_PRECIOS);
  const pagadaEn = pago.aprobadoEn && !Number.isNaN(new Date(pago.aprobadoEn).getTime()) ? new Date(pago.aprobadoEn) : new Date();
  const r = await registrarSemestre(tx, {
    P,
    institucionId: bloqueado.institucionId,
    periodo: bloqueado.periodo,
    medio: MEDIO_DE_PAGO_SEMESTRE,
    pagadaEn,
    fechaDelPago: hoyAR(pagadaEn),
    usuarioId: null,
    avisar: true,
    cobrarMesesBonificados: false,
    debitoCancelado,
    acordado: { monto: bloqueado.monto, mesesAPagar: bloqueado.mesesAPagar, usaMesBonificado: bloqueado.usaMesBonificado },
    extraAuditoria: { origen: "mercadopago", pagoId: pago.id, intentoId: bloqueado.id, preferenciaId: bloqueado.preferenciaId },
  });
  if (!r.ok) {
    // La plata entró pero el semestre no se puede registrar (por ejemplo, otro semestre cubrió esos meses mientras tanto): lo resuelve el equipo.
    await tx.update(pagosSemestreMp).set({ estado: "revisar", pagoId: bloqueado.pagoId ?? pago.id, actualizadoEn: new Date() }).where(eq(pagosSemestreMp.id, bloqueado.id));
    await avisarAlEquipo(tx, bloqueado.institucionId, "Pago de semestre para revisar", `Pagó ${pesos(bloqueado.monto)} por Mercado Pago (pago ${pago.id}) y no se pudo registrar el semestre: ${r.error}`);
    return "revisar";
  }
  await tx.update(pagosSemestreMp).set({ estado: "pagado", pagoId: pago.id, facturaId: r.facturaId, pagadoEn: pagadaEn, actualizadoEn: new Date() }).where(eq(pagosSemestreMp.id, bloqueado.id));
  if (r.mesBonificadoNoDisponible) {
    await avisarAlEquipo(tx, bloqueado.institucionId, "Semestre pagado sin su mes bonificado", `El link del semestre descontaba un mes bonificado por recomendar y al registrar el pago ya no estaba disponible: pagó ${pesos(bloqueado.monto)} (${bloqueado.mesesAPagar} meses). Revisar si hay que ajustar algo.`);
  }
  return "registrado";
}

/**
 * Aplica un pago de Mercado Pago a su intento. Idempotente y a prueba de avisos repetidos: se bloquea el intento y se vuelve a decidir adentro de la
 * transacción. Solo un pago APROBADO, en pesos y por el monto exacto que se acordó registra el semestre; cualquier otra cosa que cobró plata (monto
 * distinto, meses que ya estaban pagos, un cobro doble) deja el intento en `revisar` y le avisa al equipo, nunca se resuelve sola. Si la institución
 * tenía el débito automático activo se cancela (si no, le cobraría meses que ya pagó): ante un fallo se avisa al equipo para hacerlo a mano.
 */
export async function aplicarPagoDeSemestre(pago: PagoLeido): Promise<ResultadoDelPago> {
  if (!pago.referencia || !esUuid(pago.referencia)) return "sin-intento";
  const db = getDb();
  const [intento] = await db.select().from(pagosSemestreMp).where(eq(pagosSemestreMp.id, pago.referencia)).limit(1);
  if (!intento) return "sin-intento";

  const previa = decidirPagoDeSemestre({ intento, pago });
  if (previa.accion === "ya-registrado") return "repetido";
  if (previa.accion === "esperar") return "esperando";

  // Antes de registrar, el débito automático: Mercado Pago le cobraría meses que este semestre ya cubre. Si no se puede cancelar, el semestre se
  // registra igual (la plata ya entró) y el equipo lo cancela a mano.
  let debitoVivo = false;
  let debitoCancelado = false;
  if (previa.accion === "registrar") {
    const susc = await suscripcionDe(intento.institucionId);
    debitoVivo = !!susc && suscripcionVigente(susc.estado);
    if (debitoVivo) debitoCancelado = (await cancelarSuscripcion(intento.institucionId, { usuarioId: null, motivo: "semestre" })).ok;
  }

  const resultado = await transaccion((tx) => aplicarPagoEnTransaccion(tx, intento.id, pago, debitoCancelado));

  if (resultado === "registrado") {
    if (debitoVivo && !debitoCancelado) {
      await avisarAlEquipo(db, intento.institucionId, "Cancelar el débito automático", `Pagó el semestre por Mercado Pago y su débito automático sigue activo: cancelalo desde su ficha para que no le cobren meses que ya pagó.`).catch(() => undefined);
    }
    // Si fue recomendada y este es su primer pago, se le avisa a quien la recomendó. Después de confirmar y sin frenar nada.
    try {
      await avisarReferidorDePago(intento.institucionId);
    } catch (e) {
      console.error("No se pudo avisar el pago del semestre a quien recomendó", resumenDeError(e));
    }
  }
  return resultado;
}

/* ───────────────────────────── Recuperar un pago cuyo aviso no llegó ───────────────────────────── */

/**
 * Le pregunta a Mercado Pago por los pagos de un intento y aplica los que cuentan. Sirve cuando la persona vuelve de pagar (sin esperar el aviso) y
 * a la revisión diaria, que recupera un aviso perdido. Primero los más viejos: si hay más de un pago aprobado (un cobro doble) el primero registra y
 * los demás quedan para revisar.
 */
async function aplicarLosPagosDelIntento(intento: Pick<PagoSemestreMp, "id">): Promise<ResultadoDelPago | "sin-pagos"> {
  const crudos = await buscarPagosDeReferenciaMp(intento.id);
  const pagos = crudos.map(leerPagoMp).filter((p): p is PagoLeido => p !== null && p.referencia === intento.id);
  if (pagos.length === 0) return "sin-pagos";
  let mejor: ResultadoDelPago = "esperando";
  for (const pago of [...pagos].reverse()) {
    const r = await aplicarPagoDeSemestre(pago);
    if (r === "registrado" || r === "revisar" || r === "devuelto") mejor = r;
    else if (r === "repetido" && mejor === "esperando") mejor = "repetido";
  }
  return mejor;
}

/** Los intentos que siguen pendientes y todavía pueden recibir un pago. */
async function intentosPendientes(institucionId?: string) {
  const desde = new Date(Date.now() - DIAS_PARA_RECUPERAR_UN_PAGO * unDia);
  return getDb()
    .select()
    .from(pagosSemestreMp)
    .where(and(eq(pagosSemestreMp.estado, "pendiente"), gte(pagosSemestreMp.creadoEn, desde), ...(institucionId ? [eq(pagosSemestreMp.institucionId, institucionId)] : [])))
    .orderBy(desc(pagosSemestreMp.creadoEn));
}

export type EstadoDeLaConfirmacion = "registrado" | "esperando" | "revisar" | "sin-pendientes";

/**
 * La persona vuelve de Mercado Pago: se mira si ya hay un pago de su semestre y, si está aprobado, se registra sin esperar el aviso. Solo mira los
 * intentos de SU institución (el número nunca viene del navegador). Si Mercado Pago no está disponible no lanza: responde que sigue esperando.
 */
export async function confirmarPagoDeSemestre(institucionId: string): Promise<EstadoDeLaConfirmacion> {
  if (!mercadoPagoActivo()) return "sin-pendientes";
  const pendientes = await intentosPendientes(institucionId);
  if (pendientes.length === 0) return "sin-pendientes";
  let estado: EstadoDeLaConfirmacion = "esperando";
  for (const intento of pendientes) {
    try {
      const r = await aplicarLosPagosDelIntento(intento);
      if (r === "registrado") return "registrado";
      if (r === "revisar" || r === "devuelto") estado = "revisar";
    } catch (e) {
      console.error("No se pudo confirmar el pago del semestre", resumenDeError(e));
    }
  }
  return estado;
}

/**
 * La revisión diaria (cron): todos los intentos pendientes de los últimos días se consultan en Mercado Pago, por si un aviso nunca llegó o llegó
 * cuando el pago todavía estaba en proceso. Idempotente. Cada intento va por separado: uno que falla no frena a los demás.
 */
export async function reconciliarPagosDeSemestre(): Promise<{ revisados: number; registrados: number; paraRevisar: number; fallidos: number }> {
  const total = { revisados: 0, registrados: 0, paraRevisar: 0, fallidos: 0 };
  if (!mercadoPagoActivo()) return total;
  for (const intento of await intentosPendientes()) {
    total.revisados++;
    try {
      const r = await aplicarLosPagosDelIntento(intento);
      if (r === "registrado") total.registrados++;
      if (r === "revisar" || r === "devuelto") total.paraRevisar++;
    } catch (e) {
      total.fallidos++;
      console.error("No se pudo revisar un pago de semestre pendiente", resumenDeError(e));
    }
  }
  return total;
}

/* ───────────────────────────── Lo que muestran las pantallas ───────────────────────────── */

/**
 * Los últimos intentos de pago del semestre de una institución, para la ficha de cobros del equipo (sobre todo los que quedaron `revisar`: se pagó y no
 * se pudo registrar solo). Nunca lanza: si la tabla todavía no existe, no hay intentos que mostrar.
 */
export async function intentosDeSemestreDe(institucionId: string, ejecutor: Ejecutor = getDb()): Promise<PagoSemestreMp[]> {
  try {
    return await ejecutor.select().from(pagosSemestreMp).where(eq(pagosSemestreMp.institucionId, institucionId)).orderBy(desc(pagosSemestreMp.creadoEn)).limit(5);
  } catch (e) {
    console.error("No se pudieron leer los intentos de pago del semestre", resumenDeError(e));
    return [];
  }
}

export type DatosDePagoDeSemestre = {
  /** El semestre que se pagaría ahora; null si no se ofrece o no se puede (con el motivo en `motivo`). */
  cotizacion: Extract<Cotizacion, { ok: true }> | null;
  motivo: string | null;
  /** Hay un link de pago creado y todavía sin pagar. */
  hayLinkPendiente: boolean;
  /** Hay un pago que se aprobó y no se pudo registrar solo: el equipo lo está resolviendo. */
  paraRevisar: boolean;
};

/**
 * Lo que necesita Plan y facturación para ofrecer «Pagar el semestre». Solo se arma si Mercado Pago está activo y es para esta institución (con un
 * token de prueba, solo las de ejemplo). Nunca lanza: si algo falla (por ejemplo, la tabla de intentos todavía no existe), la pantalla simplemente no
 * ofrece el pago.
 */
export async function datosDePagoDeSemestre(institucionId: string, disponible: boolean): Promise<DatosDePagoDeSemestre> {
  const nada: DatosDePagoDeSemestre = { cotizacion: null, motivo: null, hayLinkPendiente: false, paraRevisar: false };
  if (!disponible) return nada;
  try {
    const [cot, pendientes, filas] = await Promise.all([
      cotizarSemestre(institucionId),
      intentosPendientes(institucionId),
      getDb().select({ estado: pagosSemestreMp.estado }).from(pagosSemestreMp).where(and(eq(pagosSemestreMp.institucionId, institucionId), eq(pagosSemestreMp.estado, "revisar"))).limit(1),
    ]);
    return {
      cotizacion: cot.ok ? cot : null,
      motivo: cot.ok ? null : cot.error,
      hayLinkPendiente: pendientes.length > 0,
      paraRevisar: filas.length > 0,
    };
  } catch (e) {
    console.error("No se pudieron leer los datos del pago del semestre", resumenDeError(e));
    return nada;
  }
}
