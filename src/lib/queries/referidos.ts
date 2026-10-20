import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cookies } from "next/headers";
import { getDb, transaccion } from "@/db";
import { codigosReferido, instituciones, referidosInstituciones } from "@/db/schema";
import { avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";
import { COOKIE_REFERIDO, estadoDeReferido, generarCodigo, normalizarCodigo, sePuedeAnotar, type EstadoReferido } from "@/lib/referidos";
import { resumenDeError } from "@/lib/errores";

/*
 * Referidos de instituciones (reglas y textos en src/lib/referidos.ts). El código de cada institución se crea la primera vez que
 * se lo pide; la recomendación se anota cuando la persona crea su cuenta de institución con el enlace (el navegador guarda el código
 * en una cookie mientras tanto); el equipo marca cuándo aplicó el beneficio.
 */

const azar = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0]! % n;

/** El código personal de una institución: el que ya tiene o, la primera vez, uno nuevo. */
export async function codigoDeInstitucion(institucionId: string): Promise<string> {
  const db = getDb();
  const buscar = async () => {
    const [fila] = await db.select({ codigo: codigosReferido.codigo }).from(codigosReferido).where(eq(codigosReferido.institucionId, institucionId)).limit(1);
    return fila?.codigo ?? null;
  };
  const existente = await buscar();
  if (existente) return existente;
  for (let intento = 0; intento < 5; intento++) {
    const [creado] = await db
      .insert(codigosReferido)
      .values({ institucionId, codigo: generarCodigo(azar) })
      .onConflictDoNothing()
      .returning({ codigo: codigosReferido.codigo });
    if (creado) return creado.codigo;
    // El conflicto fue porque otra visita ya le creó el código, o porque ese código ya lo tenía otra institución: se mira y se reintenta.
    const ahora = await buscar();
    if (ahora) return ahora;
  }
  throw new Error("No se pudo generar un código de referido.");
}

/** La institución dueña de un código, si sigue en pie (ni dada de baja ni suspendida). */
export async function institucionPorCodigo(codigo: string) {
  const [fila] = await getDb()
    .select({ id: instituciones.id, nombre: instituciones.nombre, propietarioId: instituciones.propietarioId })
    .from(codigosReferido)
    .innerJoin(instituciones, eq(instituciones.id, codigosReferido.institucionId))
    .where(and(eq(codigosReferido.codigo, codigo), isNull(instituciones.bajaEn), eq(instituciones.suspendida, false)))
    .limit(1);
  return fila ?? null;
}

/**
 * Se llama cuando una cuenta acaba de crear su institución: si el navegador traía el código de quien la recomendó, lo anota y le avisa
 * a esa institución en la campanita. Nunca frena el alta: si algo falla (o las tablas todavía no existen) solo queda en el log.
 * Gasta la cookie en cualquier caso, para que no se anote una segunda institución creada desde el mismo navegador.
 */
export async function anotarReferidoDelNavegador(nueva: { id: string; nombre: string; propietarioId: string }) {
  try {
    const jar = await cookies();
    const codigo = normalizarCodigo(jar.get(COOKIE_REFERIDO)?.value);
    if (!codigo) return;
    jar.delete(COOKIE_REFERIDO);

    const referidor = await institucionPorCodigo(codigo);
    if (!referidor || !sePuedeAnotar(referidor, { id: nueva.id, propietarioId: nueva.propietarioId })) return;

    await transaccion(async (tx) => {
      const [fila] = await tx
        .insert(referidosInstituciones)
        .values({ referidorId: referidor.id, referidoId: nueva.id })
        .onConflictDoNothing()
        .returning({ id: referidosInstituciones.id });
      if (!fila) return;
      await avisarAVarios(tx, await destinatariosDeInstitucion(tx, referidor.id), {
        tipo: "sistema",
        titulo: nueva.nombre,
        texto: "se registró con tu enlace de referidos. Cuando el equipo la verifique, tu beneficio queda listo.",
        enlace: "/institucion/referidos",
      });
    });
  } catch (e) {
    console.error("No se pudo anotar el referido", resumenDeError(e));
  }
}

/**
 * La institución recién verificada fue recomendada por otra: se le avisa que su beneficio está listo. Se llama después de verificar y
 * nunca la frena (el paso del referido se calcula de la verificación, así que no depende de que este aviso salga).
 */
export async function avisarReferidorDeVerificacion(institucionId: string) {
  try {
    const db = getDb();
    const [fila] = await db
      .select({ referidorId: referidosInstituciones.referidorId, nombre: instituciones.nombre })
      .from(referidosInstituciones)
      .innerJoin(instituciones, eq(instituciones.id, referidosInstituciones.referidoId))
      .where(and(eq(referidosInstituciones.referidoId, institucionId), isNull(referidosInstituciones.beneficioEn)))
      .limit(1);
    if (!fila) return;
    await avisarAVarios(db, await destinatariosDeInstitucion(db, fila.referidorId), {
      tipo: "sistema",
      titulo: fila.nombre,
      texto: "ya es parte de la red de UNIDOAR: tu beneficio por recomendarla está listo para aplicarse.",
      enlace: "/institucion/referidos",
    });
  } catch (e) {
    console.error("No se pudo avisar la verificación de un referido", resumenDeError(e));
  }
}

export type ReferidoDeInstitucion = {
  id: string;
  institucion: { nombre: string; slug: string };
  estado: EstadoReferido;
  creadoEn: Date;
  beneficioEn: Date | null;
};

/** Las instituciones que recomendó una institución, de la más nueva a la más vieja. */
export async function referidosDe(institucionId: string): Promise<ReferidoDeInstitucion[]> {
  const filas = await getDb()
    .select({
      id: referidosInstituciones.id,
      nombre: instituciones.nombre,
      slug: instituciones.slug,
      verificada: instituciones.verificada,
      creadoEn: referidosInstituciones.creadoEn,
      beneficioEn: referidosInstituciones.beneficioEn,
    })
    .from(referidosInstituciones)
    .innerJoin(instituciones, eq(instituciones.id, referidosInstituciones.referidoId))
    .where(eq(referidosInstituciones.referidorId, institucionId))
    .orderBy(desc(referidosInstituciones.creadoEn));
  return filas.map((f) => ({
    id: f.id,
    institucion: { nombre: f.nombre, slug: f.slug },
    estado: estadoDeReferido(f),
    creadoEn: f.creadoEn,
    beneficioEn: f.beneficioEn,
  }));
}

export type ReferidoBackoffice = {
  id: string;
  estado: EstadoReferido;
  creadoEn: Date;
  beneficioEn: Date | null;
  referidor: { id: string; nombre: string };
  referido: { id: string; nombre: string; verificada: boolean };
};

/** Todas las recomendaciones, de la más nueva a la más vieja (el equipo las ve y aplica los beneficios). */
export async function listarReferidosBackoffice(): Promise<ReferidoBackoffice[]> {
  const referidora = alias(instituciones, "referidora");
  const filas = await getDb()
    .select({
      id: referidosInstituciones.id,
      creadoEn: referidosInstituciones.creadoEn,
      beneficioEn: referidosInstituciones.beneficioEn,
      referidorId: referidora.id,
      referidorNombre: referidora.nombre,
      referidoId: instituciones.id,
      referidoNombre: instituciones.nombre,
      referidoVerificada: instituciones.verificada,
    })
    .from(referidosInstituciones)
    .innerJoin(referidora, eq(referidora.id, referidosInstituciones.referidorId))
    .innerJoin(instituciones, eq(instituciones.id, referidosInstituciones.referidoId))
    .orderBy(desc(referidosInstituciones.creadoEn));
  return filas.map((f) => ({
    id: f.id,
    estado: estadoDeReferido({ verificada: f.referidoVerificada, beneficioEn: f.beneficioEn }),
    creadoEn: f.creadoEn,
    beneficioEn: f.beneficioEn,
    referidor: { id: f.referidorId, nombre: f.referidorNombre },
    referido: { id: f.referidoId, nombre: f.referidoNombre, verificada: f.referidoVerificada },
  }));
}
