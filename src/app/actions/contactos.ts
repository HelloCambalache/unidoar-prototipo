"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { contactosInstitucion } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { MAX_CVS_POR_INSTITUCION, aplicarCambioDeCv, cabeOtroCv, leerCambioDeCv, type CvGuardado } from "@/lib/contacto-cv";
import {
  MAX_CONTACTOS_POR_INSTITUCION,
  MAX_FILAS_IMPORTACION,
  claveDeTelefono,
  contactoSchema,
  filasCrudasSchema,
  validarFilas,
} from "@/lib/contactos";
import { quitados } from "@/lib/archivos";
import { resumenDeError } from "@/lib/errores";
import { borrarArchivos } from "@/lib/queries/archivos";

/*
 * Contactos privados de la institución (Profesionales → "Cargar perfil" e "Importar CSV"). Cualquier persona del
 * equipo los gestiona, igual que los favoritos y las invitaciones. Un id que viene del cliente no se usa sin
 * chequear que el contacto es de la institución de la sesión.
 */

const NO_ENCONTRADO = "No encontramos ese contacto.";
const EMAIL_REPETIDO = "Ya tenés un contacto con ese email.";
const TOPE_DE_CV = `Llegaste al máximo de ${MAX_CVS_POR_INSTITUCION} contactos con CV adjunto. Quitale el CV a alguno para sumar otro.`;

const refrescar = () => revalidatePath("/institucion/base-de-docentes");

function esViolacionUnica(e: unknown): boolean {
  const codigo = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return codigo === "23505";
}

/** Cuántos contactos de la institución ya tienen un CV adjunto (cuenta contra `MAX_CVS_POR_INSTITUCION`). */
async function contactosConCv(ejecutor: Pick<ReturnType<typeof getDb>, "select">, institucionId: string): Promise<number> {
  const [fila] = await ejecutor
    .select({ n: count() })
    .from(contactosInstitucion)
    .where(and(eq(contactosInstitucion.institucionId, institucionId), isNotNull(contactosInstitucion.cvPath)));
  return fila?.n ?? 0;
}

/**
 * Crea un contacto, o lo edita si el formulario trae su `id`. Recibe el FormData del diálogo. El CV (opcional, un PDF) llega como
 * `cvAccion` (igual | quitar | nuevo) y, con «nuevo», el path que acaba de subir el navegador (`cvPath`, `cvNombre`): el servidor solo
 * lo acepta si es de esta cuenta y de la carpeta de CV de contactos (`leerCambioDeCv`). El archivo que se reemplaza o se quita se borra
 * de Storage después de guardar.
 */
export async function guardarContacto(_previo: Resultado<{ id: string }> | null, formData: FormData): Promise<Resultado<{ id: string }>> {
  const { usuario, institucion } = await requerirInstitucion();
  const datos = parsear(contactoSchema, formData);
  if (!datos.ok) return fallo(datos.error, datos.campos);
  const { nombre, email, telefono, disciplina, nota } = datos.data;
  const valores = {
    nombre,
    email: email ?? null,
    telefono: telefono ?? null,
    disciplina: disciplina ?? null,
    nota: nota ?? null,
  };
  const lectura = leerCambioDeCv(
    { accion: formData.get("cvAccion"), path: formData.get("cvPath"), nombre: formData.get("cvNombre") },
    usuario.id,
  );
  if (!lectura.ok) return fallo(lectura.error);
  const { cambio } = lectura;

  const db = getDb();
  const id = formData.get("id");
  let archivoQuitado: string | null = null;
  try {
    if (typeof id === "string" && id !== "") {
      if (!esUuid(id)) return fallo(NO_ENCONTRADO);
      const resultado = await transaccion(async (tx) => {
        // Se relee y se bloquea la fila: el CV que había se decide con lo que hay ahora, no con lo que la pantalla creía.
        const [actual] = await tx
          .select({ id: contactosInstitucion.id, cvPath: contactosInstitucion.cvPath, cvNombre: contactosInstitucion.cvNombre })
          .from(contactosInstitucion)
          .where(and(eq(contactosInstitucion.id, id), eq(contactosInstitucion.institucionId, institucion.id)))
          .limit(1)
          .for("update");
        if (!actual) return fallo(NO_ENCONTRADO);
        const guardado: CvGuardado = actual.cvPath ? { path: actual.cvPath, nombre: actual.cvNombre ?? "" } : null;
        const nuevo = aplicarCambioDeCv(guardado, cambio);
        if (nuevo && !guardado && !cabeOtroCv(await contactosConCv(tx, institucion.id))) return fallo(TOPE_DE_CV);
        await tx
          .update(contactosInstitucion)
          .set({ ...valores, cvPath: nuevo?.path ?? null, cvNombre: nuevo?.nombre ?? null })
          .where(eq(contactosInstitucion.id, actual.id));
        archivoQuitado = quitados([guardado?.path], [nuevo?.path])[0] ?? null;
        return ok({ id: actual.id });
      });
      if (!resultado.ok) return resultado;
      await borrarArchivos([archivoQuitado]);
      refrescar();
      return resultado;
    }

    const [cargados] = await db
      .select({ n: count() })
      .from(contactosInstitucion)
      .where(eq(contactosInstitucion.institucionId, institucion.id));
    if ((cargados?.n ?? 0) >= MAX_CONTACTOS_POR_INSTITUCION) {
      return fallo(`Llegaste al máximo de ${MAX_CONTACTOS_POR_INSTITUCION} contactos cargados. Borrá algunos para sumar nuevos.`);
    }
    const cv = aplicarCambioDeCv(null, cambio);
    if (cv && !cabeOtroCv(await contactosConCv(db, institucion.id))) return fallo(TOPE_DE_CV);
    const [nuevo] = await db
      .insert(contactosInstitucion)
      .values({
        ...valores,
        cvPath: cv?.path ?? null,
        cvNombre: cv?.nombre ?? null,
        institucionId: institucion.id,
        origen: "manual",
        creadoPor: usuario.id,
      })
      .returning({ id: contactosInstitucion.id });
    refrescar();
    return ok({ id: nuevo!.id });
  } catch (e) {
    // El índice único (institución, email) es la red de seguridad si dos personas cargan el mismo email a la vez.
    if (esViolacionUnica(e)) return fallo(EMAIL_REPETIDO, { email: EMAIL_REPETIDO });
    console.error("No se pudo guardar el contacto", resumenDeError(e));
    return fallo("No pudimos guardar el contacto. Probá de nuevo.");
  }
}

export async function borrarContacto(contactoId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(contactoId)) return fallo(NO_ENCONTRADO);
  const [borrado] = await getDb()
    .delete(contactosInstitucion)
    .where(and(eq(contactosInstitucion.id, contactoId), eq(contactosInstitucion.institucionId, institucion.id)))
    .returning({ id: contactosInstitucion.id, cvPath: contactosInstitucion.cvPath });
  if (!borrado) return fallo(NO_ENCONTRADO);
  // Su CV (si tenía) ya no lo usa ninguna fila: se borra de Storage después de confirmar la base y nunca rompe el borrado.
  await borrarArchivos([borrado.cvPath]);
  refrescar();
  return ok();
}

export type ResumenImportacion = { creados: number; yaEstaban: number; conError: number; repetidasEnArchivo: number };

/**
 * Importa las filas de un CSV que el navegador ya leyó. El servidor vuelve a validar todo (mismas reglas que el
 * formulario), descarta lo que la institución ya tiene (por email o, si la fila no tiene email, por teléfono) y
 * lo repetido dentro del archivo, y guarda el resto en una sola transacción.
 */
export async function importarContactos(filas: unknown): Promise<Resultado<ResumenImportacion>> {
  const { usuario, institucion } = await requerirInstitucion();
  const crudas = filasCrudasSchema.safeParse(filas);
  if (!crudas.success) {
    const demasiadas = crudas.error.issues.some((i) => i.code === "too_big");
    return fallo(demasiadas ? `El archivo tiene más de ${MAX_FILAS_IMPORTACION} filas: partilo en varios.` : "El archivo no tiene el formato esperado.");
  }
  const { validas, errores, repetidasEnArchivo } = validarFilas(crudas.data);
  if (validas.length === 0) return fallo("No hay filas válidas para importar.");

  const resultado = await transaccion(async (tx) => {
    const existentes = await tx
      .select({ email: contactosInstitucion.email, telefono: contactosInstitucion.telefono })
      .from(contactosInstitucion)
      .where(eq(contactosInstitucion.institucionId, institucion.id));
    const emails = new Set(existentes.flatMap((c) => (c.email ? [c.email] : [])));
    const telefonos = new Set(existentes.flatMap((c) => (!c.email && c.telefono ? [claveDeTelefono(c.telefono)] : [])));

    const nuevas = validas.filter((c) => (c.email ? !emails.has(c.email) : !telefonos.has(claveDeTelefono(c.telefono ?? ""))));
    if (existentes.length + nuevas.length > MAX_CONTACTOS_POR_INSTITUCION) {
      return fallo(`Con este archivo pasarías el máximo de ${MAX_CONTACTOS_POR_INSTITUCION} contactos cargados. Borrá algunos o importá menos filas.`);
    }
    if (nuevas.length === 0) {
      return ok<ResumenImportacion>({ creados: 0, yaEstaban: validas.length, conError: errores.length, repetidasEnArchivo });
    }

    const insertados = await tx
      .insert(contactosInstitucion)
      .values(
        nuevas.map((c) => ({
          institucionId: institucion.id,
          nombre: c.nombre,
          email: c.email ?? null,
          telefono: c.telefono ?? null,
          disciplina: c.disciplina ?? null,
          nota: c.nota ?? null,
          origen: "csv",
          creadoPor: usuario.id,
        })),
      )
      // Si otra persona del equipo cargó el mismo email un instante antes, esa fila se saltea.
      .onConflictDoNothing()
      .returning({ id: contactosInstitucion.id });
    return ok<ResumenImportacion>({
      creados: insertados.length,
      yaEstaban: validas.length - insertados.length,
      conError: errores.length,
      repetidasEnArchivo,
    });
  });

  if (resultado.ok) refrescar();
  return resultado;
}
