"use server";

import { revalidatePath } from "next/cache";
import { quitados } from "@/lib/archivos";
import { borrarArchivos } from "@/lib/queries/archivos";
import { redirect } from "next/navigation";
import { eq, like } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { docenteDetalle, docentes, institucionMiembros, instituciones, type DocumentosDocente } from "@/db/schema";
import { parsear } from "@/lib/acciones";
import { docenteDeUsuario, docenteEnAlta, institucionEnAlta, institucionPropia, usuarioParaAlta } from "@/lib/alta";
import { encolarParaEquipo } from "@/lib/correo/cola";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { registrarAceptacionDeTerminos } from "@/lib/queries/terminos";
import { RUTA_INICIO, TIPOS_CON_CUE, institucionDatosSchema, institucionPerfilSchema } from "@/lib/catalogo";
import {
  CATEGORIA_ALTA,
  OBLIGATORIOS_DATOS_DOCENTE,
  categoriaDocenteSchema,
  datosDocenteSchema,
  disponibilidadDesdeGrilla,
  grillaTieneHorarios,
  nivelesHorariosSchema,
  partirNombre,
  pathPrivadoSchema,
  rutaPasoPendienteDocente,
  type EstadoFormulario,
} from "@/lib/onboarding";
import { datosDeSesion } from "@/lib/sesion";
import { notificar } from "@/lib/queries/notificaciones";
import { nombresDeAsignaturas, ubicarDocente, ubicarInstitucion } from "@/lib/queries/onboarding";
import { ubicarPorDireccion } from "@/lib/queries/ubicacion";
import { ubicacionDeInstitucion } from "@/lib/ubicacion";
import { esPathPrivadoPropio, esUrlPublicaPropia } from "@/lib/subidas";
import { slugify } from "@/lib/utils";

/*
 * Acciones del alta. Cada paso es un `<form action>` con `useActionState`: valida con Zod, verifica
 * que el recurso sea de quien lo envía, guarda y redirige al paso siguiente. Los formularios traen un
 * campo oculto `destino`: "continuar" (por defecto), "salir" (Guardar y salir: guarda y vuelve al inicio),
 * "borrador" (guarda y se queda) o "luego" (paso de documentación: terminar sin subir más).
 */

type Destino = "continuar" | "salir" | "borrador" | "luego";

function destinoDe(formData: FormData): Destino {
  const v = formData.get("destino");
  return v === "salir" || v === "borrador" || v === "luego" ? v : "continuar";
}

const textos = (formData: FormData, clave: string) =>
  formData.getAll(clave).filter((v): v is string => typeof v === "string");

const textoDe = (formData: FormData, clave: string) => {
  const v = formData.get(clave);
  return typeof v === "string" ? v : null;
};

/** Lo escrito en el formulario, para devolverlo y que React no lo pierda al reiniciar los campos. */
function valoresDe(formData: FormData): Record<string, string | string[]> {
  const salida: Record<string, string | string[]> = {};
  for (const clave of new Set(formData.keys())) {
    if (clave.startsWith("$")) continue;
    const todos = textos(formData, clave);
    salida[clave] = todos.length > 1 ? todos : (todos[0] ?? "");
  }
  return salida;
}

const conError = (formData: FormData, error: string, campos?: Record<string, string>): EstadoFormulario => ({
  ok: false,
  error,
  campos,
  valores: valoresDe(formData),
});

const orNull = <T>(v: T | undefined) => v ?? null;

/** Sin duplicados (sin distinguir mayúsculas), respetando el orden y cómo lo escribió la persona. */
function sinRepetidos(lista: string[]) {
  const vistos = new Set<string>();
  return lista.filter((x) => {
    const clave = x.trim().toLowerCase();
    if (!clave || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

function esViolacionUnica(e: unknown): boolean {
  const codigo = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return codigo === "23505";
}

/* ───────────────────────── Institución ───────────────────────── */

/** Slug único a partir del nombre: "colegio-san-andres", y con sufijo numérico si ya existe. */
async function slugLibre(nombre: string) {
  const base = slugify(nombre) || "institucion";
  const usados = await getDb().select({ slug: instituciones.slug }).from(instituciones).where(like(instituciones.slug, `${base}%`));
  const ocupados = new Set(usados.map((u) => u.slug));
  if (!ocupados.has(base)) return base;
  for (let n = 2; n < 500; n++) if (!ocupados.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Paso 2 de la institución ("Contanos sobre tu institución"). Crea la institución con la cuenta como
 * propietaria y miembro dueño, o —si ya la había creado— actualiza sus datos sin duplicarla ni cambiar su slug.
 */
export async function crearInstitucion(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await usuarioParaAlta("institucion");

  const r = parsear(institucionDatosSchema, formData);
  if (!r.ok) return conError(formData, r.error, r.campos);
  const d = r.data;
  // La institución acepta los términos en este paso (el formulario no se valida sin la casilla).
  await registrarAceptacionDeTerminos(usuario.id);

  // Coordenadas: las de la dirección (Georef / OpenStreetMap) si se pudo ubicar; si no, las del catálogo de zonas.
  const delCatalogo = await ubicarInstitucion({ direccion: d.direccion, partido: d.partido });
  const deLaDireccion = await ubicarPorDireccion({
    direccion: d.direccion,
    partido: d.partido,
    provincia: d.provincia,
    token: textoDe(formData, "ubicacion"),
    osm: true,
  });
  const ubicacion = ubicacionDeInstitucion(delCatalogo, deLaDireccion);
  const db = getDb();
  const existente = await institucionPropia(usuario.id);
  const datos = {
    nombre: d.nombre,
    tipo: d.tipo,
    fundada: orNull(d.fundada),
    contactoNombre: d.contactoNombre,
    contactoRol: d.contactoRol,
    telefono: d.telefono,
    cuit: orNull(d.cuit),
    // El código CUE es solo de los establecimientos educativos.
    cue: TIPOS_CON_CUE.includes(d.tipo) ? orNull(d.cue) : null,
    direccion: d.direccion,
    partido: d.partido,
    provincia: d.provincia,
    zona: ubicacion.zona,
  };

  if (existente) {
    await db
      .update(instituciones)
      .set({ ...datos, lat: ubicacion.lat ?? existente.lat, lng: ubicacion.lng ?? existente.lng })
      .where(eq(instituciones.id, existente.id));
  } else {
    const crear = async (slug: string) =>
      transaccion(async (tx) => {
        const [creada] = await tx
          .insert(instituciones)
          .values({ ...datos, slug, propietarioId: usuario.id, lat: ubicacion.lat, lng: ubicacion.lng, esDemo: false })
          .returning({ id: instituciones.id });
        await tx
          .insert(institucionMiembros)
          .values({
            institucionId: creada!.id,
            usuarioId: usuario.id,
            email: usuario.email,
            nombre: d.contactoNombre,
            rol: "dueno",
            estado: "activo",
          })
          .onConflictDoNothing();
      });
    try {
      await crear(await slugLibre(d.nombre));
    } catch (e) {
      // Otra institución tomó el mismo slug entre la consulta y el insert: se reintenta con un sufijo al azar.
      if (!esViolacionUnica(e)) throw e;
      await crear(`${slugify(d.nombre) || "institucion"}-${crypto.randomUUID().slice(0, 6)}`);
    }
  }

  revalidatePath("/institucion", "layout");
  redirect(destinoDe(formData) === "salir" ? "/" : "/onboarding/institucion/3");
}

/** Paso 3 de la institución: descripción, logo y portada (todo opcional). Al terminar entra al dashboard. */
export async function actualizarPerfilInstitucion(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { usuario, institucion } = await institucionEnAlta();

  const r = parsear(institucionPerfilSchema, formData);
  if (!r.ok) return conError(formData, r.error, r.campos);
  const { descripcion, logoUrl, portadaUrl } = r.data;

  // Solo se aceptan imágenes que subió esta misma cuenta (o la que ya estaba guardada).
  const campos: Record<string, string> = {};
  if (logoUrl && logoUrl !== institucion.logoUrl && !esUrlPublicaPropia(logoUrl, usuario.id)) {
    campos.logoUrl = "Ese archivo no es válido. Subí el logo de nuevo.";
  }
  if (portadaUrl && portadaUrl !== institucion.portadaUrl && !esUrlPublicaPropia(portadaUrl, usuario.id)) {
    campos.portadaUrl = "Ese archivo no es válido. Subí la portada de nuevo.";
  }
  if (Object.keys(campos).length > 0) return conError(formData, "Revisá los archivos marcados.", campos);

  await getDb()
    .update(instituciones)
    .set({ descripcion: orNull(descripcion), logoUrl: orNull(logoUrl), portadaUrl: orNull(portadaUrl) })
    .where(eq(instituciones.id, institucion.id));
  await borrarArchivos(quitados([institucion.logoUrl, institucion.portadaUrl], [logoUrl, portadaUrl]));

  revalidatePath("/institucion", "layout");
  revalidatePath(`/instituciones/${institucion.slug}`);
  redirect(destinoDe(formData) === "salir" ? "/" : RUTA_INICIO.institucion);
}

/* ───────────────────────── Docente ───────────────────────── */

/**
 * "¿Qué sos?": categoría, asignaturas (del catálogo en base) y situación de estudio. Crea el perfil
 * `docentes` con los datos de la cuenta (nombre, email, foto) la primera vez; después actualiza.
 */
export async function guardarCategoriaDocente(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await usuarioParaAlta("docente");

  const r = parsear(categoriaDocenteSchema, {
    categoria: formData.get("categoria") ?? "",
    asignaturas: textos(formData, "asignaturas"),
    estudio: formData.get("estudio") ?? "",
  });
  if (!r.ok) return conError(formData, r.error, r.campos);
  const { categoria, estudio } = r.data;
  const asignaturas = sinRepetidos(r.data.asignaturas);

  const validas = await nombresDeAsignaturas(categoria);
  if (asignaturas.some((a) => !validas.has(a))) {
    return conError(formData, "Revisá los campos marcados.", { asignaturas: "Elegí asignaturas de la lista de esa categoría." });
  }

  const db = getDb();
  let docente = await docenteDeUsuario(usuario.id);
  if (docente?.onboardingCompleto) redirect(RUTA_INICIO.docente);

  if (docente) {
    await db.update(docentes).set({ categoria, asignaturas }).where(eq(docentes.id, docente.id));
  } else {
    const sesion = await datosDeSesion();
    const { nombre, apellido } = partirNombre(sesion?.nombre ?? "", usuario.email.split("@")[0] ?? "Docente");
    await db
      .insert(docentes)
      .values({ usuarioId: usuario.id, nombre, apellido, email: usuario.email, fotoUrl: sesion?.fotoUrl ?? null, categoria, asignaturas })
      .onConflictDoNothing();
    docente = await docenteDeUsuario(usuario.id);
    if (!docente) return conError(formData, "No pudimos crear tu perfil. Probá de nuevo.");
  }

  await db
    .insert(docenteDetalle)
    .values({ docenteId: docente.id, situacionEstudio: estudio })
    .onConflictDoUpdate({ target: docenteDetalle.docenteId, set: { situacionEstudio: estudio, actualizadoEn: new Date() } });

  revalidatePath("/docente", "layout");
  redirect(destinoDe(formData) === "salir" ? "/" : "/onboarding/docente/3");
}

/** "Tu perfil": datos personales y zonas. "Guardar borrador" guarda sin exigir los campos con asterisco. */
export async function guardarDatosDocente(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { docente } = await docenteEnAlta();
  const destino = destinoDe(formData);

  const r = parsear(datosDocenteSchema, {
    nombre: formData.get("nombre") ?? "",
    apellido: formData.get("apellido") ?? "",
    fechaNacimiento: formData.get("fechaNacimiento") ?? "",
    dni: formData.get("dni") ?? "",
    telefono: formData.get("telefono") ?? "",
    cuil: formData.get("cuil") ?? "",
    direccion: formData.get("direccion") ?? "",
    partido: formData.get("partido") ?? "",
    provincia: formData.get("provincia") ?? "",
    zonas: textos(formData, "zonas"),
  });
  if (!r.ok) return conError(formData, r.error, r.campos);
  const d = r.data;

  if (destino === "continuar") {
    const faltan: Record<string, string> = {};
    for (const [campo, mensaje] of Object.entries(OBLIGATORIOS_DATOS_DOCENTE)) {
      if (!d[campo as keyof typeof OBLIGATORIOS_DATOS_DOCENTE]) faltan[campo] = mensaje;
    }
    if (Object.keys(faltan).length > 0) return conError(formData, "Revisá los campos marcados.", faltan);
  }

  const zonas = sinRepetidos(d.zonas);
  const ubicacion = await ubicarDocente({ zonas, partido: d.partido });
  const db = getDb();
  await db
    .update(docentes)
    .set({
      // nombre y apellido no pueden quedar vacíos: en un borrador sin ellos se conservan los anteriores.
      nombre: d.nombre ?? docente.nombre,
      apellido: d.apellido ?? docente.apellido,
      telefono: orNull(d.telefono),
      zonas,
      lat: ubicacion.lat,
      lng: ubicacion.lng,
    })
    .where(eq(docentes.id, docente.id));

  const detalle = {
    fechaNacimiento: orNull(d.fechaNacimiento),
    dni: orNull(d.dni),
    cuil: orNull(d.cuil),
    direccion: orNull(d.direccion),
    partido: orNull(d.partido),
    provincia: orNull(d.provincia),
    actualizadoEn: new Date(),
  };
  await db
    .insert(docenteDetalle)
    .values({ docenteId: docente.id, ...detalle })
    .onConflictDoUpdate({ target: docenteDetalle.docenteId, set: detalle });

  revalidatePath("/docente", "layout");
  if (destino === "salir") redirect("/");
  if (destino === "borrador") {
    revalidatePath("/onboarding/docente/3");
    return { ok: true, mensaje: "Borrador guardado.", valores: valoresDe(formData) };
  }
  redirect("/onboarding/docente/2");
}

/** "Tu CV": guarda el path del PDF subido al bucket privado (opcional). */
export async function guardarCvDocente(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { usuario, docente } = await docenteEnAlta();

  const cv = pathPrivadoSchema.safeParse(formData.get("cv") ?? "");
  if (!cv.success) return conError(formData, "El archivo no es válido. Subilo de nuevo.", { cv: "Subí el CV de nuevo." });
  const path = cv.data;
  // Solo un archivo que subió esta misma cuenta a su carpeta de CV (o el que ya estaba guardado).
  if (path && path !== docente.cvUrl && !esPathPrivadoPropio(path, usuario.id, "cv")) {
    return conError(formData, "El archivo no es válido. Subilo de nuevo.", { cv: "Subí el CV de nuevo." });
  }

  await getDb().update(docentes).set({ cvUrl: orNull(path) }).where(eq(docentes.id, docente.id));
  await borrarArchivos(quitados([docente.cvUrl], [path]));

  revalidatePath("/docente", "layout");
  redirect(destinoDe(formData) === "salir" ? "/" : "/onboarding/docente/asignaturas");
}

/** "¿A quiénes y cuándo?": niveles y grilla semanal. De la grilla se deriva `docentes.disponibilidad` (lo que filtra el buscador). */
export async function guardarNivelesYHorarios(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { docente } = await docenteEnAlta();

  let grilla: unknown;
  try {
    grilla = JSON.parse(String(formData.get("grilla") ?? ""));
  } catch {
    grilla = null;
  }
  const r = parsear(nivelesHorariosSchema, {
    niveles: textos(formData, "niveles"),
    incluyeOtro: formData.get("incluyeOtro") === "on",
    otrosNiveles: formData.get("otrosNiveles") ?? "",
    grilla,
  });
  if (!r.ok) return conError(formData, r.error, r.campos);
  const d = r.data;

  const campos: Record<string, string> = {};
  if (d.niveles.length === 0 && !d.incluyeOtro) campos.niveles = "Elegí al menos un nivel.";
  if (d.incluyeOtro && !d.otrosNiveles) campos.otrosNiveles = "Contanos con qué otro nivel trabajás.";
  if (!grillaTieneHorarios(d.grilla)) campos.grilla = "Marcá al menos un horario para que las instituciones sepan cuándo podés.";
  if (Object.keys(campos).length > 0) return conError(formData, "Revisá los campos marcados.", campos);

  const otros = d.incluyeOtro
    ? d.otrosNiveles
      ? sinRepetidos(d.otrosNiveles.split(/[,;/]+/).map((x) => x.trim().slice(0, 40))).slice(0, 4)
      : ["Otro"]
    : [];
  const db = getDb();
  await db
    .update(docentes)
    .set({ niveles: [...d.niveles, ...otros], disponibilidad: disponibilidadDesdeGrilla(d.grilla) })
    .where(eq(docentes.id, docente.id));
  await db
    .insert(docenteDetalle)
    .values({ docenteId: docente.id, grillaDisponibilidad: d.grilla })
    .onConflictDoUpdate({ target: docenteDetalle.docenteId, set: { grillaDisponibilidad: d.grilla, actualizadoEn: new Date() } });

  revalidatePath("/docente", "layout");
  redirect(destinoDe(formData) === "salir" ? "/" : "/onboarding/docente/4");
}

const DOCUMENTOS_DEL_ALTA = ["dniFrente", "dniDorso", "credencial"] as const;

/**
 * "Subí tu documentación" (último paso): guarda los paths de lo que subió al bucket privado y cierra el alta
 * (`onboardingCompleto = true`). La verificación NO cambia: queda en "pendiente" hasta que el equipo la revise.
 */
export async function guardarDocumentacionDocente(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { usuario, docente } = await docenteEnAlta();
  const destino = destinoDe(formData);

  const db = getDb();
  const [detalle] = await db.select().from(docenteDetalle).where(eq(docenteDetalle.docenteId, docente.id)).limit(1);
  const previos: DocumentosDocente = detalle?.documentos ?? {};

  const documentos: DocumentosDocente = { ...previos };
  const campos: Record<string, string> = {};
  for (const clave of DOCUMENTOS_DEL_ALTA) {
    // Un documento que el formulario no mostró (ej. el título de quien todavía estudia) no se toca.
    if (!formData.has(clave)) continue;
    const p = pathPrivadoSchema.safeParse(formData.get(clave) ?? "");
    if (!p.success) {
      campos[clave] = "Subí el archivo de nuevo.";
      continue;
    }
    const path = p.data;
    if (!path) {
      delete documentos[clave];
    } else if (path === previos[clave] || esPathPrivadoPropio(path, usuario.id, "documentos")) {
      documentos[clave] = path;
    } else {
      campos[clave] = "Subí el archivo de nuevo.";
    }
  }
  if (Object.keys(campos).length > 0) return conError(formData, "Revisá los archivos marcados.", campos);

  await db
    .insert(docenteDetalle)
    .values({ docenteId: docente.id, documentos })
    .onConflictDoUpdate({ target: docenteDetalle.docenteId, set: { documentos, actualizadoEn: new Date() } });
  // Un DNI o un título que se vuelve a subir no tiene por qué seguir guardado.
  await borrarArchivos(quitados(Object.values(previos), Object.values(documentos)));

  if (destino === "salir") {
    revalidatePath("/docente", "layout");
    redirect("/");
  }

  // No se cierra el alta sin lo básico: si falta algo de los pasos anteriores, se vuelve a ese paso.
  const pendiente = rutaPasoPendienteDocente(docente);
  if (pendiente !== "/onboarding/docente/4") redirect(pendiente);

  const asignaturas = docente.asignaturas.slice(0, 2).join(", ");
  await db
    .update(docentes)
    .set({
      onboardingCompleto: true,
      subtitulo: docente.subtitulo ?? (asignaturas ? `${CATEGORIA_ALTA[docente.categoria].label} · ${asignaturas}` : CATEGORIA_ALTA[docente.categoria].label),
    })
    .where(eq(docentes.id, docente.id));

  if (Object.keys(documentos).length > 0) {
    await notificar(usuario.id, {
      tipo: "verificacion",
      titulo: "Recibimos tu documentación.",
      texto: "Tu perfil figura como sin verificar hasta que la revisemos. Te avisamos por acá apenas esté lista.",
      enlace: "/docente/perfil",
    });
    // El equipo se entera de que hay un alta con documentación para revisar.
    const nombreCompleto = `${docente.nombre} ${docente.apellido}`.trim();
    await transaccion(async (tx) => {
      await avisarAAdmins(tx, {
        titulo: nombreCompleto,
        texto: "terminó el alta y subió documentación para que la revisen.",
        enlace: `/backoffice/docentes/${docente.id}`,
      });
      await encolarParaEquipo(
        tx,
        "M61",
        { docente: nombreCompleto, detalle: "terminó el alta y subió documentación para que la revisen.", ruta: `/backoffice/docentes/${docente.id}` },
        { clave: `M61:alta:${docente.id}` },
      );
    });
  }

  revalidatePath("/docente", "layout");
  redirect(RUTA_INICIO.docente);
}
