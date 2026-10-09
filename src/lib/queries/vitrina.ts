import "server-only";
import { and, asc, desc, eq, gt, isNull, notInArray, or, sql } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { busquedas, cursos, institucionFotos, institucionNovedades, instituciones, postulaciones } from "@/db/schema";
import {
  sinRepetidos,
  type BusquedaAbierta,
  type CursoVitrina,
  type DatosVitrina,
  type VitrinaFotoVista,
  type VitrinaNovedadVista,
} from "@/lib/vitrina";

/**
 * Misma regla que `busquedaVigente` (queries/instituciones.ts): activa y, si es rápida, con plazo vigente. No se
 * importa de allá porque instituciones.ts usa la galería y las novedades de este archivo y se cerraría un ciclo.
 */
const busquedaAbierta = () =>
  and(eq(busquedas.estado, "activa"), or(isNull(busquedas.venceEn), gt(busquedas.venceEn, new Date())));

/** Galería de instalaciones de una institución, en el orden que le dio. */
export async function fotosDeInstitucion(institucionId: string): Promise<VitrinaFotoVista[]> {
  const filas = await getDb()
    .select({ id: institucionFotos.id, url: institucionFotos.url, etiqueta: institucionFotos.etiqueta })
    .from(institucionFotos)
    .where(eq(institucionFotos.institucionId, institucionId))
    .orderBy(asc(institucionFotos.orden), asc(institucionFotos.creadoEn));
  return filas.map((f) => ({ id: f.id, url: f.url, etiqueta: f.etiqueta ?? "" }));
}

/** Novedades publicadas, las más recientes primero (fecha de la novedad; a igual fecha, la cargada después). */
export async function novedadesDeInstitucion(institucionId: string, limite?: number): Promise<VitrinaNovedadVista[]> {
  const consulta = getDb()
    .select({
      id: institucionNovedades.id,
      titulo: institucionNovedades.titulo,
      texto: institucionNovedades.texto,
      fecha: institucionNovedades.fecha,
    })
    .from(institucionNovedades)
    .where(eq(institucionNovedades.institucionId, institucionId))
    .orderBy(desc(institucionNovedades.fecha), desc(institucionNovedades.creadoEn));
  return await (limite ? consulta.limit(limite) : consulta);
}

/** Lo que "Mi perfil" muestra además de los campos editables: galería, novedades, cursos y búsquedas abiertas. */
export async function datosVitrina(institucionId: string) {
  const db = getDb();
  const [fotos, novedades, listaCursos, abiertas] = await Promise.all([
    fotosDeInstitucion(institucionId),
    novedadesDeInstitucion(institucionId),
    db
      .select({
        id: cursos.id,
        titulo: cursos.titulo,
        subtitulo: cursos.subtitulo,
        descripcion: cursos.descripcion,
        fotoUrl: cursos.fotoUrl,
      })
      .from(cursos)
      .where(eq(cursos.institucionId, institucionId))
      .orderBy(sql`${cursos.fechaInicio} desc nulls last`, asc(cursos.titulo)),
    db
      .select({
        id: busquedas.id,
        puesto: busquedas.puesto,
        postulantes: sql<number>`count(${postulaciones.id}) filter (where ${postulaciones.etapa} <> 'descartado')`.mapWith(Number),
      })
      .from(busquedas)
      .leftJoin(postulaciones, eq(postulaciones.busquedaId, busquedas.id))
      .where(and(eq(busquedas.institucionId, institucionId), busquedaAbierta()))
      .groupBy(busquedas.id)
      .orderBy(desc(busquedas.creadoEn)),
  ]);
  return { fotos, novedades, cursos: listaCursos satisfies CursoVitrina[], busquedasAbiertas: abiertas satisfies BusquedaAbierta[] };
}

const vacioANull = (v: string) => (v.trim() ? v.trim() : null);

/**
 * Persiste "Guardar cambios" de Mi perfil en una sola transacción: datos de la institución, valores, galería y
 * novedades. Recibe el estado completo (ya validado): lo que ya no viene se borra, lo que trae un `id` de esta
 * institución se actualiza y lo demás se crea; un `id` ajeno o inexistente se trata como nuevo, nunca se toca la
 * fila de otra institución. Devuelve las listas ya con sus ids, en el orden en que se muestran.
 * La autorización y la validación de las URLs de imágenes las hace la acción que la llama.
 */
export async function guardarVitrina(institucionId: string, d: DatosVitrina) {
  return transaccion(async (tx) => {
    await tx
      .update(instituciones)
      .set({
        nombre: d.nombre,
        tipo: d.tipo,
        fundada: d.fundada,
        alumnos: d.alumnos,
        niveles: vacioANull(d.niveles),
        turnos: vacioANull(d.turnos),
        docentesPlanta: d.docentesPlanta,
        descripcion: vacioANull(d.descripcion),
        contactoNombre: d.contactoNombre,
        contactoRol: d.contactoRol,
        mision: vacioANull(d.mision),
        vision: vacioANull(d.vision),
        valores: sinRepetidos(d.valores),
        horarioAdministracion: vacioANull(d.horarioAdministracion),
        logoUrl: vacioANull(d.logoUrl),
        portadaUrl: vacioANull(d.portadaUrl),
      })
      .where(eq(instituciones.id, institucionId));

    // Galería: se borra lo que ya no está, se actualiza lo que cambió (o se movió) y se crea lo nuevo.
    const fotosActuales = await tx
      .select({ id: institucionFotos.id, url: institucionFotos.url, etiqueta: institucionFotos.etiqueta, orden: institucionFotos.orden })
      .from(institucionFotos)
      .where(eq(institucionFotos.institucionId, institucionId));
    const porId = new Map(fotosActuales.map((f) => [f.id, f]));
    const idsFotos = d.fotos.flatMap((f) => (f.id && porId.has(f.id) ? [f.id] : []));
    await tx
      .delete(institucionFotos)
      .where(
        idsFotos.length > 0
          ? and(eq(institucionFotos.institucionId, institucionId), notInArray(institucionFotos.id, idsFotos))
          : eq(institucionFotos.institucionId, institucionId),
      );
    for (const [orden, f] of d.fotos.entries()) {
      const actual = f.id ? porId.get(f.id) : undefined;
      if (!actual) {
        await tx.insert(institucionFotos).values({ institucionId, url: f.url, etiqueta: vacioANull(f.etiqueta), orden });
      } else if (actual.url !== f.url || (actual.etiqueta ?? "") !== f.etiqueta || actual.orden !== orden) {
        await tx
          .update(institucionFotos)
          .set({ url: f.url, etiqueta: vacioANull(f.etiqueta), orden })
          .where(and(eq(institucionFotos.id, actual.id), eq(institucionFotos.institucionId, institucionId)));
      }
    }

    // Novedades: mismo criterio.
    const novedadesActuales = await tx
      .select({ id: institucionNovedades.id })
      .from(institucionNovedades)
      .where(eq(institucionNovedades.institucionId, institucionId));
    const propias = new Set(novedadesActuales.map((n) => n.id));
    const idsNovedades = d.novedades.flatMap((n) => (n.id && propias.has(n.id) ? [n.id] : []));
    await tx
      .delete(institucionNovedades)
      .where(
        idsNovedades.length > 0
          ? and(eq(institucionNovedades.institucionId, institucionId), notInArray(institucionNovedades.id, idsNovedades))
          : eq(institucionNovedades.institucionId, institucionId),
      );
    for (const n of d.novedades) {
      const valores = { titulo: n.titulo, texto: n.texto, fecha: n.fecha };
      if (n.id && propias.has(n.id)) {
        await tx
          .update(institucionNovedades)
          .set(valores)
          .where(and(eq(institucionNovedades.id, n.id), eq(institucionNovedades.institucionId, institucionId)));
      } else {
        await tx.insert(institucionNovedades).values({ institucionId, ...valores });
      }
    }

    const fotos = await tx
      .select({ id: institucionFotos.id, url: institucionFotos.url, etiqueta: institucionFotos.etiqueta })
      .from(institucionFotos)
      .where(eq(institucionFotos.institucionId, institucionId))
      .orderBy(institucionFotos.orden, institucionFotos.creadoEn);
    const novedades = await tx
      .select({
        id: institucionNovedades.id,
        titulo: institucionNovedades.titulo,
        texto: institucionNovedades.texto,
        fecha: institucionNovedades.fecha,
      })
      .from(institucionNovedades)
      .where(eq(institucionNovedades.institucionId, institucionId))
      .orderBy(desc(institucionNovedades.fecha), desc(institucionNovedades.creadoEn));
    return { fotos: fotos.map((f) => ({ id: f.id, url: f.url, etiqueta: f.etiqueta ?? "" })), novedades };
  });
}
