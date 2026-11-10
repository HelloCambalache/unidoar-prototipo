import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, transaccion, type Tx } from "@/db";
import { creditosBusqueda, instituciones, pagosPuntualMp, type PagoPuntualMp } from "@/db/schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { esUuid } from "@/lib/busquedas";
import { hoyAR, periodoActual } from "@/lib/cobros";
import { correoDePagoRegistrado } from "@/lib/correo/eventos";
import { origenDeLosMails } from "@/lib/correo/config";
import { resumenDeError } from "@/lib/errores";
import { buscarPagosDeReferenciaMp, crearPreferenciaMp, ErrorDeMercadoPago } from "@/lib/mercadopago-cliente";
import { mercadoPagoActivo, RUTA_DEL_WEBHOOK } from "@/lib/mercadopago-config";
import { decidirPagoDePuntual, MEDIO_DE_PAGO_PUNTUAL, motivoParaNoOfrecerPagoPuntual, PARAMETRO_DE_VUELTA_PUNTUAL, tituloDelPagoPuntual } from "@/lib/pago-puntual";
import { cuerpoDePreferencia, DIAS_DE_VIGENCIA_DEL_LINK, DIAS_PARA_RECUPERAR_UN_PAGO, leerPagoMp, type PagoLeido } from "@/lib/pago-semestre";
import { esClavePlan, pesos, type PlanClave } from "@/lib/planes";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { avisarAAdmins, avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeFacturacion, destinatariosDeInstitucion, type EjecutorBo } from "@/lib/queries/backoffice-instituciones";
import type { ResultadoDelPago } from "@/lib/queries/pago-semestre";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { planesParaCobrarOFallar, SIN_PRECIOS } from "@/lib/queries/planes";
import { saldoDeBusquedas } from "@/lib/queries/puntuales";

/*
 * Una búsqueda puntual pagada por Mercado Pago, de punta a punta (reglas puras en src/lib/pago-puntual.ts; ver «Pago de una búsqueda puntual por
 * Mercado Pago» en CLAUDE.md). Es el mismo camino que el pago del semestre (src/lib/queries/pago-semestre.ts): la institución pide su link, paga en
 * Mercado Pago y, cuando el pago se aprueba, queda UNA búsqueda pagada y disponible (`creditos_busqueda`), igual que cuando la registra el equipo.
 * Lo que cuenta es lo que Mercado Pago contesta al preguntarle por el pago, nunca lo que dice el aviso.
 */

const MENSAJE_SIN_MERCADO_PAGO = "El pago por Mercado Pago todavía no está disponible. Escribinos desde Contacto y coordinamos el pago de tu búsqueda.";
const unDia = 24 * 60 * 60 * 1000;

/* ───────────────────────────── Cuánto sale ───────────────────────────── */

export type CotizacionPuntual =
  | {
      ok: true;
      plan: PlanClave;
      planLabel: string;
      /** Pesos que se pagan (el precio del plan de búsqueda puntual o el acordado con la institución). */
      monto: number;
      /** Cuántos días queda abierta la búsqueda una vez publicada. */
      vigenciaDias: number;
    }
  | { ok: false; error: string };

/**
 * Cuánto sale una búsqueda puntual para esta institución: la misma cuenta que hace el equipo al registrar el pago (`montoDePlan` del plan puntual con
 * su precio acordado), siempre calculada en el servidor. Si no se puede (plan con abono, plan sin precio, ya tiene una búsqueda pagada sin publicar)
 * devuelve el motivo.
 */
export async function cotizarPuntual(institucionId: string, ejecutor: EjecutorBo = getDb()): Promise<CotizacionPuntual> {
  const P = await planesParaCobrarOFallar();
  if (!P) return { ok: false, error: SIN_PRECIOS };
  const [inst] = await ejecutor.select({ plan: instituciones.plan, bajaEn: instituciones.bajaEn }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);
  if (!inst || inst.bajaEn) return { ok: false, error: "No encontramos tu institución." };
  const esPuntual = esClavePlan(inst.plan) && P.esPuntual(inst.plan);
  const acuerdo = await acuerdoDe(ejecutor, institucionId);
  const motivo = motivoParaNoOfrecerPagoPuntual({
    esPuntual,
    precioDefinido: esPuntual && P.precioDefinido(inst.plan, acuerdo),
    disponibles: esPuntual ? (await saldoDeBusquedas(ejecutor, institucionId)).disponibles : 0,
  });
  if (motivo) return { ok: false, error: motivo };
  if (!esClavePlan(inst.plan)) return { ok: false, error: "Tu plan no es el de búsqueda puntual." };

  const monto = P.montoDePlan(inst.plan, 1, acuerdo);
  if (!Number.isInteger(monto) || monto <= 0) return { ok: false, error: "No pudimos calcular el precio de tu búsqueda. Escribinos desde Contacto." };
  return { ok: true, plan: inst.plan, planLabel: P.planDe(inst.plan).label, monto, vigenciaDias: P.condiciones.puntual.vigenciaDias };
}

/* ───────────────────────────── Armar el link de pago ───────────────────────────── */

/**
 * Crea el link de pago de una búsqueda puntual (Checkout Pro) y devuelve la dirección de Mercado Pago a la que hay que mandar a la persona. El que llama
 * ya comprobó que es dueño o administrador. Si ya hay un link vigente por el mismo monto se reutiliza: así tocar el botón varias veces no deja varios
 * links que se puedan pagar por duplicado. Nada de lo que se paga viene del navegador.
 */
export async function prepararPagoDePuntual(inst: { id: string; nombre: string }, usuarioId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!mercadoPagoActivo()) return { ok: false, error: MENSAJE_SIN_MERCADO_PAGO };
  const cot = await cotizarPuntual(inst.id);
  if (!cot.ok) return cot;

  const db = getDb();
  // Un link anterior que sigue vigente por lo mismo se reutiliza (se deja un día de margen para que no venza mientras la persona paga).
  const [vigente] = await db
    .select()
    .from(pagosPuntualMp)
    .where(
      and(
        eq(pagosPuntualMp.institucionId, inst.id),
        eq(pagosPuntualMp.estado, "pendiente"),
        eq(pagosPuntualMp.monto, cot.monto),
        gte(pagosPuntualMp.creadoEn, new Date(Date.now() - (DIAS_DE_VIGENCIA_DEL_LINK - 1) * unDia)),
      ),
    )
    .orderBy(desc(pagosPuntualMp.creadoEn))
    .limit(1);
  if (vigente?.enlace) return { ok: true, url: vigente.enlace };

  const [intento] = await db.insert(pagosPuntualMp).values({ institucionId: inst.id, plan: cot.plan, monto: cot.monto }).returning({ id: pagosPuntualMp.id });
  if (!intento) return { ok: false, error: "No pudimos armar el pago. Probá de nuevo en un momento." };

  try {
    const preferencia = await crearPreferenciaMp(
      cuerpoDePreferencia({
        referencia: intento.id,
        titulo: tituloDelPagoPuntual(cot.planLabel),
        descripcion: `Una búsqueda puntual de ${inst.nombre}: una vez pagada la publicás y queda abierta ${cot.vigenciaDias} días.`,
        monto: cot.monto,
        origen: origenDeLosMails(),
        rutaDelAviso: RUTA_DEL_WEBHOOK,
        parametroDeVuelta: PARAMETRO_DE_VUELTA_PUNTUAL,
      }),
    );
    if (!preferencia.enlace) throw new ErrorDeMercadoPago("no-disponible", "Mercado Pago no devolvió una dirección de pago válida.");
    await db.update(pagosPuntualMp).set({ preferenciaId: preferencia.id, enlace: preferencia.enlace, actualizadoEn: new Date() }).where(eq(pagosPuntualMp.id, intento.id));
    await registrarAuditoria({
      usuarioId,
      accion: "busqueda_puntual.enlace_de_pago",
      entidad: "institucion",
      entidadId: inst.id,
      detalle: { intentoId: intento.id, monto: cot.monto },
    });
    return { ok: true, url: preferencia.enlace };
  } catch (e) {
    // Sin link no hay nada que pagar: el intento no sirve y se borra (nadie pagó nada todavía).
    await db.delete(pagosPuntualMp).where(eq(pagosPuntualMp.id, intento.id)).catch(() => undefined);
    console.error("No se pudo crear el link de pago de la búsqueda puntual", resumenDeError(e));
    return { ok: false, error: "No pudimos armar el pago en Mercado Pago. Probá de nuevo en un momento o escribinos desde Contacto." };
  }
}

/* ───────────────────────────── Un pago que avisa Mercado Pago ───────────────────────────── */

/** Un aviso al equipo con el enlace a la ficha de cobros de la institución. */
async function avisarAlEquipo(ejecutor: Ejecutor, institucionId: string, titulo: string, texto: string) {
  const [inst] = await ejecutor.select({ nombre: instituciones.nombre }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);
  await avisarAAdmins(ejecutor, { titulo, texto: `${inst?.nombre ?? "Una institución"}: ${texto}`, enlace: `/backoffice/cobros/${institucionId}` });
}

/**
 * Lo que pasa adentro de la transacción cuando llega un pago de Mercado Pago: se bloquea el intento, se vuelve a decidir con lo que hay en este momento y,
 * si corresponde, queda una búsqueda pagada. Separada de `aplicarPagoDePuntual` para poder probarla con una transacción que se deshace.
 */
export async function aplicarPagoPuntualEnTransaccion(tx: Tx, intentoId: string, pago: PagoLeido): Promise<ResultadoDelPago> {
  const [bloqueado] = await tx.select().from(pagosPuntualMp).where(eq(pagosPuntualMp.id, intentoId)).limit(1).for("update");
  if (!bloqueado) return "sin-intento";
  const decision = decidirPagoDePuntual({ intento: bloqueado, pago });
  if (decision.accion === "ya-registrado") return "repetido";
  if (decision.accion === "esperar") return "esperando";

  // Una búsqueda ya registrada (`pagado`) NO cambia de estado por una devolución o un segundo pago: queda pagada hasta que el equipo decida (anular el pago
  // en Cobros) y el intento tiene que seguir diciendo `pagado`, para que un aviso repetido no la registre de nuevo.
  if (decision.accion === "devuelto") {
    await avisarAlEquipo(tx, bloqueado.institucionId, "Pago de búsqueda devuelto", `Mercado Pago informa que se devolvió el pago ${pago.id} de una búsqueda puntual (${pesos(bloqueado.monto)}), que ya estaba registrado. Revisar si hay que anular el pago en Cobros.`);
    return "devuelto";
  }
  if (decision.accion === "revisar") {
    if (bloqueado.estado !== "pagado") {
      await tx.update(pagosPuntualMp).set({ estado: "revisar", pagoId: bloqueado.pagoId ?? pago.id, actualizadoEn: new Date() }).where(eq(pagosPuntualMp.id, bloqueado.id));
    }
    await avisarAlEquipo(tx, bloqueado.institucionId, "Pago de búsqueda para revisar", `Mercado Pago aprobó el pago ${pago.id} de una búsqueda puntual y no se registró solo. ${decision.motivo}`);
    return "revisar";
  }

  const P = await planesParaCobrarOFallar();
  // Sin los precios vigentes no se registra: se lanza y Mercado Pago vuelve a avisar.
  if (!P) throw new Error(SIN_PRECIOS);
  const pagadoEn = pago.aprobadoEn && !Number.isNaN(new Date(pago.aprobadoEn).getTime()) ? new Date(pago.aprobadoEn) : new Date();

  const marcarParaRevisar = async (motivo: string) => {
    await tx.update(pagosPuntualMp).set({ estado: "revisar", pagoId: bloqueado.pagoId ?? pago.id, actualizadoEn: new Date() }).where(eq(pagosPuntualMp.id, bloqueado.id));
    await avisarAlEquipo(tx, bloqueado.institucionId, "Pago de búsqueda para revisar", `Pagó ${pesos(bloqueado.monto)} por Mercado Pago (pago ${pago.id}) y no se pudo registrar la búsqueda: ${motivo}`);
    return "revisar" as const;
  };

  // La institución tiene que seguir existiendo y con el plan de búsqueda puntual (si pasó a un abono o se dio de baja mientras tanto, la plata entró y lo resuelve el equipo).
  const [inst] = await tx
    .select({ id: instituciones.id, nombre: instituciones.nombre, plan: instituciones.plan, bajaEn: instituciones.bajaEn })
    .from(instituciones)
    .where(eq(instituciones.id, bloqueado.institucionId))
    .limit(1)
    .for("update");
  if (!inst || inst.bajaEn) return marcarParaRevisar("la institución ya no está activa.");
  if (!P.esPuntual(inst.plan)) return marcarParaRevisar("su plan ya no es el de búsqueda puntual.");

  const [credito] = await tx
    .insert(creditosBusqueda)
    .values({ institucionId: inst.id, monto: bloqueado.monto, medio: MEDIO_DE_PAGO_PUNTUAL, pagadoEn, nota: `Pago ${pago.id} de Mercado Pago` })
    .returning({ id: creditosBusqueda.id });
  await tx
    .update(pagosPuntualMp)
    .set({ estado: "pagado", pagoId: pago.id, creditoId: credito!.id, pagadoEn, actualizadoEn: new Date() })
    .where(eq(pagosPuntualMp.id, bloqueado.id));
  await registrarAuditoria(
    {
      usuarioId: null,
      accion: "busqueda_puntual.pago",
      entidad: "institucion",
      entidadId: inst.id,
      detalle: { creditoId: credito!.id, monto: bloqueado.monto, medio: MEDIO_DE_PAGO_PUNTUAL, fechaPago: hoyAR(pagadoEn), origen: "mercadopago", pagoId: pago.id, intentoId: bloqueado.id },
    },
    tx,
  );
  await avisarAVarios(tx, await destinatariosDeInstitucion(tx, inst.id), {
    tipo: "sistema",
    titulo: "UNIDOAR",
    texto: `recibimos tu pago de una búsqueda puntual (${pesos(bloqueado.monto)}). Ya podés publicarla: queda abierta ${P.condiciones.puntual.vigenciaDias} días. ¡Gracias!`,
    enlace: "/institucion/publicar",
  });
  await correoDePagoRegistrado(tx, {
    usuarioIds: await destinatariosDeFacturacion(tx, inst.id),
    institucion: inst.nombre,
    periodo: periodoActual(),
    concepto: "una búsqueda puntual",
    monto: bloqueado.monto,
  });
  return "registrado";
}

/**
 * Aplica un pago de Mercado Pago a su intento. Idempotente y a prueba de avisos repetidos: se bloquea el intento y se vuelve a decidir adentro de la
 * transacción. Solo un pago APROBADO, en pesos y por el monto exacto que se acordó deja la búsqueda pagada; cualquier otra cosa que cobró plata (monto
 * distinto, un cobro doble, un plan que cambió) deja el intento en `revisar` y le avisa al equipo, nunca se resuelve sola. Devuelve `sin-intento` si la
 * referencia del pago no es de ningún link de búsqueda puntual (pasa con los pagos del semestre, de las suscripciones y de cualquier otro de la cuenta).
 */
export async function aplicarPagoDePuntual(pago: PagoLeido): Promise<ResultadoDelPago> {
  if (!pago.referencia || !esUuid(pago.referencia)) return "sin-intento";
  const db = getDb();
  const [intento] = await db.select().from(pagosPuntualMp).where(eq(pagosPuntualMp.id, pago.referencia)).limit(1);
  if (!intento) return "sin-intento";

  const previa = decidirPagoDePuntual({ intento, pago });
  if (previa.accion === "ya-registrado") return "repetido";
  if (previa.accion === "esperar") return "esperando";
  return transaccion((tx) => aplicarPagoPuntualEnTransaccion(tx, intento.id, pago));
}

/* ───────────────────────────── Recuperar un pago cuyo aviso no llegó ───────────────────────────── */

/**
 * Le pregunta a Mercado Pago por los pagos de un intento y aplica los que cuentan. Sirve cuando la persona vuelve de pagar (sin esperar el aviso) y a la
 * revisión diaria, que recupera un aviso perdido. Primero los más viejos: si hay más de un pago aprobado (un cobro doble) el primero registra y los demás
 * quedan para revisar.
 */
async function aplicarLosPagosDelIntento(intento: Pick<PagoPuntualMp, "id">): Promise<ResultadoDelPago | "sin-pagos"> {
  const crudos = await buscarPagosDeReferenciaMp(intento.id);
  const pagos = crudos.map(leerPagoMp).filter((p): p is PagoLeido => p !== null && p.referencia === intento.id);
  if (pagos.length === 0) return "sin-pagos";
  let mejor: ResultadoDelPago = "esperando";
  for (const pago of [...pagos].reverse()) {
    const r = await aplicarPagoDePuntual(pago);
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
    .from(pagosPuntualMp)
    .where(and(eq(pagosPuntualMp.estado, "pendiente"), gte(pagosPuntualMp.creadoEn, desde), ...(institucionId ? [eq(pagosPuntualMp.institucionId, institucionId)] : [])))
    .orderBy(desc(pagosPuntualMp.creadoEn));
}

export type EstadoDeLaConfirmacionPuntual = "registrado" | "esperando" | "revisar" | "sin-pendientes";

/**
 * La persona vuelve de Mercado Pago: se mira si ya hay un pago de su búsqueda y, si está aprobado, se registra sin esperar el aviso. Solo mira los intentos
 * de SU institución (el número nunca viene del navegador). Si Mercado Pago no está disponible no lanza: responde que sigue esperando.
 */
export async function confirmarPagoDePuntual(institucionId: string): Promise<EstadoDeLaConfirmacionPuntual> {
  if (!mercadoPagoActivo()) return "sin-pendientes";
  const pendientes = await intentosPendientes(institucionId);
  if (pendientes.length === 0) return "sin-pendientes";
  let estado: EstadoDeLaConfirmacionPuntual = "esperando";
  for (const intento of pendientes) {
    try {
      const r = await aplicarLosPagosDelIntento(intento);
      if (r === "registrado") return "registrado";
      if (r === "revisar" || r === "devuelto") estado = "revisar";
    } catch (e) {
      console.error("No se pudo confirmar el pago de la búsqueda puntual", resumenDeError(e));
    }
  }
  return estado;
}

/**
 * La revisión diaria (cron): todos los intentos pendientes de los últimos días se consultan en Mercado Pago, por si un aviso nunca llegó o llegó cuando el
 * pago todavía estaba en proceso. Idempotente. Cada intento va por separado: uno que falla no frena a los demás.
 */
export async function reconciliarPagosDePuntual(): Promise<{ revisados: number; registrados: number; paraRevisar: number; fallidos: number }> {
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
      console.error("No se pudo revisar un pago de búsqueda puntual pendiente", resumenDeError(e));
    }
  }
  return total;
}

/* ───────────────────────────── Lo que muestran las pantallas ───────────────────────────── */

/**
 * Los últimos intentos de pago de una búsqueda puntual de una institución, para la ficha de cobros del equipo (sobre todo los que quedaron `revisar`: se pagó
 * y no se pudo registrar solo). Nunca lanza: si la tabla todavía no existe, no hay intentos que mostrar.
 */
export async function intentosDePuntualDe(institucionId: string, ejecutor: Ejecutor = getDb()): Promise<PagoPuntualMp[]> {
  try {
    return await ejecutor.select().from(pagosPuntualMp).where(eq(pagosPuntualMp.institucionId, institucionId)).orderBy(desc(pagosPuntualMp.creadoEn)).limit(5);
  } catch (e) {
    console.error("No se pudieron leer los intentos de pago de la búsqueda puntual", resumenDeError(e));
    return [];
  }
}

export type DatosDePagoDePuntual = {
  /** La búsqueda que se pagaría ahora; null si no se ofrece o no se puede (con el motivo en `motivo`). */
  cotizacion: Extract<CotizacionPuntual, { ok: true }> | null;
  motivo: string | null;
  /** Hay un link de pago creado y todavía sin pagar. */
  hayLinkPendiente: boolean;
  /** Hay un pago que se aprobó y no se pudo registrar solo: el equipo lo está resolviendo. */
  paraRevisar: boolean;
};

/**
 * Lo que necesita Plan y facturación para ofrecer «Pagar una búsqueda». Solo se arma si Mercado Pago está disponible para esta institución. Nunca lanza: si
 * algo falla (por ejemplo, la tabla de intentos todavía no existe), la pantalla simplemente no ofrece el pago.
 */
export async function datosDePagoDePuntual(institucionId: string, disponible: boolean): Promise<DatosDePagoDePuntual> {
  const nada: DatosDePagoDePuntual = { cotizacion: null, motivo: null, hayLinkPendiente: false, paraRevisar: false };
  if (!disponible) return nada;
  try {
    const [cot, pendientes, filas] = await Promise.all([
      cotizarPuntual(institucionId),
      intentosPendientes(institucionId),
      getDb().select({ estado: pagosPuntualMp.estado }).from(pagosPuntualMp).where(and(eq(pagosPuntualMp.institucionId, institucionId), eq(pagosPuntualMp.estado, "revisar"))).limit(1),
    ]);
    return { cotizacion: cot.ok ? cot : null, motivo: cot.ok ? null : cot.error, hayLinkPendiente: pendientes.length > 0, paraRevisar: filas.length > 0 };
  } catch (e) {
    console.error("No se pudieron leer los datos del pago de la búsqueda puntual", resumenDeError(e));
    return nada;
  }
}
