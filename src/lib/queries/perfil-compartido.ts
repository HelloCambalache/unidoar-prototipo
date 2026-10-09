import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { docentes } from "@/db/schema";
import { esTokenDePerfil } from "@/lib/compartir-perfil";
import { docenteVisible } from "@/lib/visibilidad";

/**
 * El perfil de /profesional/<token>: lo que la persona decidió mostrar al prender "Compartir mi perfil". Se eligen las columnas
 * una por una a propósito: NUNCA el teléfono, el email, el CV, los documentos ni el domicilio. Una columna nueva solo entra
 * si es algo que la persona aceptaría ver en una página pública.
 * Devuelve null si el token no existe, está apagado, la cuenta está suspendida o el alta no se completó.
 */
export async function perfilCompartido(token: string) {
  if (!esTokenDePerfil(token)) return null;
  const [d] = await getDb()
    .select({
      nombre: docentes.nombre,
      apellido: docentes.apellido,
      categoria: docentes.categoria,
      subtitulo: docentes.subtitulo,
      resumen: docentes.resumen,
      fotoUrl: docentes.fotoUrl,
      zonas: docentes.zonas,
      asignaturas: docentes.asignaturas,
      niveles: docentes.niveles,
      aniosExperiencia: docentes.aniosExperiencia,
      experiencia: docentes.experiencia,
      formacion: docentes.formacion,
      verificacion: docentes.verificacion,
      tituloVerificado: docentes.tituloVerificado,
      antecedentesVerificados: docentes.antecedentesVerificados,
    })
    .from(docentes)
    .where(and(eq(docentes.compartirToken, token), docenteVisible, eq(docentes.onboardingCompleto, true)))
    .limit(1);
  return d ?? null;
}

export type PerfilCompartido = NonNullable<Awaited<ReturnType<typeof perfilCompartido>>>;
