"use server";

import { count, gt, sql } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { mensajesContacto } from "@/db/schema";
import { parsear } from "@/lib/acciones";
import { contactoSchema, type EstadoContacto, type ValoresContacto } from "@/lib/contacto";
import { encolarParaEquipo } from "@/lib/correo/cola";

/** Mensajes por email y hora: corta el spam sin pedir captcha. */
const MAX_POR_HORA = 5;
/** Mensajes de todos juntos por hora: el uso normal es de unos pocos al día; esto solo se alcanza con un ataque. */
const MAX_EN_TOTAL_POR_HORA = 40;

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/**
 * Guarda un mensaje del formulario de /contacto. Es público (sin sesión), por eso
 * valida todo en el servidor y descarta lo que complete el campo trampa `sitio_web`.
 */
export async function enviarContacto(_previo: EstadoContacto, formData: FormData): Promise<EstadoContacto> {
  // Campo oculto que un humano no completa: si viene lleno es un bot, no le damos pistas.
  if (texto(formData.get("sitio_web")).trim()) return { ok: true };

  const valores: ValoresContacto = {
    nombre: texto(formData.get("nombre")),
    email: texto(formData.get("email")),
    rol: texto(formData.get("rol")),
    rolOtro: texto(formData.get("rolOtro")),
    mensaje: texto(formData.get("mensaje")),
  };

  const r = parsear(contactoSchema, formData);
  if (!r.ok) return { ok: false, error: r.error, campos: r.campos, valores };

  // Con "Otro" y un texto, el equipo lee "Otro: Secretaria de un colegio" en lugar de solo "Otro".
  const { rolOtro, ...datos } = r.data;
  const rol = datos.rol === "Otro" && rolOtro ? `Otro: ${rolOtro}` : datos.rol;

  try {
    const db = getDb();
    const [{ deEsteEmail, enTotal }] = await db
      .select({
        deEsteEmail: sql<number>`count(*) filter (where ${mensajesContacto.email} = ${r.data.email})`.mapWith(Number),
        enTotal: count(),
      })
      .from(mensajesContacto)
      .where(gt(mensajesContacto.creadoEn, sql`now() - interval '1 hour'`));
    if (deEsteEmail >= MAX_POR_HORA) {
      return { ok: false, error: "Ya recibimos varios mensajes tuyos. Te respondemos a la brevedad.", valores };
    }
    // Cambiando de email se esquiva el tope de arriba: este corta una avalancha desde cualquier lado (el captcha lo reemplazaría).
    if (enTotal >= MAX_EN_TOTAL_POR_HORA) {
      return { ok: false, error: "Estamos recibiendo muchos mensajes en este momento. Probá de nuevo en un rato.", valores };
    }
    // El mensaje y el mail al equipo se guardan juntos: si uno falla, no queda el otro.
    await transaccion(async (tx) => {
      await tx.insert(mensajesContacto).values({ ...datos, rol });
      await encolarParaEquipo(tx, "M60", { nombre: datos.nombre, email: datos.email, rol, mensaje: datos.mensaje });
    });
  } catch (e) {
    console.error("No se pudo guardar el mensaje de contacto", e);
    return { ok: false, error: "No pudimos enviar tu mensaje. Probá de nuevo en unos minutos.", valores };
  }
  return { ok: true };
}
