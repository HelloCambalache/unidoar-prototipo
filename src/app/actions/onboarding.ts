"use server";

import { revalidatePath } from "next/cache";
import { quitados } from "@/lib/archivos";
import { planes } from "@/lib/queries/planes";
import { borrarArchivos } from "@/lib/queries/archivos";
import { redirect } from "next/navigation";
import { and, eq, like } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { docenteDetalle, docentes, institucionMiembros, instituciones, type DocumentosDocente } from "@/db/schema";
import { parsear } from "@/lib/acciones";
import { docenteDeUsuario, docenteEnAlta, institucionEnAlta, institucionPropia, usuarioParaAlta } from "@/lib/alta";
import { encolarParaEquipo } from "@/lib/correo/cola";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { copiarFotoDeGoogle } from "@/lib/queries/foto-de-google";
import { rechazarInvitacion, sumarseAlEquipo } from "@/lib/queries/equipo";
import { anotarReferidoDelNavegador } from "@/lib/queries/referidos";
import { registrarAceptacionDeTerminos } from "@/lib/queries/terminos";
import { RUTA_INICIO, TIPOS_CON_CUE, institucionDatosSchema, institucionPerfilSchema } from "@/lib/catalogo";
import { valorElegido } from "@/lib/otro";
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
  rutaPasoDocente,
  rutaPasoPendienteDocente,
  type EstadoFormulario,
} from "@/lib/onboarding";
import { leerPorcentaje } from "@/lib/estudiantes";
import { datosDeSesion } from "@/lib/sesion";
import { notificar } from "@/lib/queries/notificaciones";
import { nombresDeAsignaturas, ubicarDocente, ubicarInstitucion } from "@/lib/queries/onboarding";
import { guardarSedePrincipal } from "@/lib/queries/sedes";
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

/** ¿La cuenta ya es miembro activo del equipo de alguna institución? */
async function esMiembroActivo(usuarioId: string): Promise<boolean> {
  const [fila] = await getDb()
    .select({ id: institucionMiembros.id })
    .from(institucionMiembros)
    .where(and(eq(institucionMiembros.usuarioId, usuarioId), eq(institucionMiembros.estado, "activo")))
    .limit(1);
  return Boolean(fila);
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
  const propia = await institucionPropia(usuario.id);

  if (propia?.verificada) {
    // El equipo ya revisó el nombre, el tipo y el CUIT: desde acá no se pisan (la pantalla ni siquiera se ofrece; esto cubre un pedido directo).
    return conError(formData, "Tu institución ya está verificada. Para cambiar sus datos escribinos desde Contacto.");
  }
  if (!propia && (await esMiembroActivo(usuario.id))) {
    // Ya es parte del equipo de otra institución: crear una propia dejaría a la misma persona en dos cuentas.
    redirect(RUTA_INICIO.institucion);
  }

  const r = parsear(institucionDatosSchema, formData);
  if (!r.ok) return conError(formData, r.error, r.campos);
  const d = r.data;
  // "Otro" en el tipo o en el rol: se guarda lo que escribió la persona, y tiene que haber escrito algo.
  const tipo = valorElegido(d.tipo, d.tipoOtro);
  const contactoRol = valorElegido(d.contactoRol, d.contactoRolOtro);
  if (!tipo || !contactoRol) {
    return conError(formData, "Revisá los campos marcados.", {
      ...(!tipo && { tipoOtro: "Escribí cuál es el tipo de institución" }),
      ...(!contactoRol && { contactoRolOtro: "Escribí cuál es tu rol" }),
    });
  }
  // Los términos se aceptan al crear la cuenta (paso 1) y ahí queda la constancia. Una cuenta que no la tiene (se creó antes de
  // ese cambio) los acepta en este paso, y el servidor lo exige: no alcanza con que el formulario lo pida.
  if (!usuario.terminosAceptadosEn) {
    if (formData.get("aceptaTerminos") !== "on") {
      return conError(formData, "Revisá los campos marcados.", { aceptaTerminos: "Tenés que aceptar los términos y condiciones" });
    }
    await registrarAceptacionDeTerminos(usuario.id);
  }

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
  const existente = propia;
  const P = await planes();
  const datos = {
    nombre: d.nombre,
    tipo,
    fundada: orNull(d.fundada),
    contactoNombre: d.contactoNombre,
    contactoRol,
    telefono: d.telefono,
    cuit: orNull(d.cuit),
    // El código CUE es solo de los establecimientos educativos.
    cue: TIPOS_CON_CUE.includes(d.tipo) ? orNull(d.cue) : null,
  };
  // El lugar es de la sede principal (la ficha de la institución recibe la copia en el mismo paso). Sin coordenadas nuevas
  // se conservan las que ya tenía.
  const ubicacionDeLaSede = {
    direccion: d.direccion,
    partido: d.partido,
    provincia: d.provincia,
    zona: ubicacion.zona,
    cue: datos.cue,
    ...(ubicacion.lat != null && ubicacion.lng != null ? { lat: ubicacion.lat, lng: ubicacion.lng } : {}),
  };

  if (existente) {
    await transaccion(async (tx) => {
      // El plan sigue al tipo mientras sea el que le tocaba (uno que cambió el equipo a mano no se toca): ver `planTrasCambiarElTipo`.
      await tx
        .update(instituciones)
        .set({ ...datos, plan: P.planTrasCambiarElTipo(existente.plan, existente.tipo, tipo) })
        .where(eq(instituciones.id, existente.id));
      await guardarSedePrincipal(tx, existente.id, ubicacionDeLaSede);
    });
  } else {
    const crear = async (slug: string) =>
      transaccion(async (tx) => {
        const [creada] = await tx
          .insert(instituciones)
          // El plan sale del tipo de institución, no de lo que elija: ver planPorTipo en src/lib/planes.ts (el catálogo editable de /backoffice/planes).
          .values({ ...datos, slug, plan: P.planPorTipo(d.tipo), propietarioId: usuario.id, esDemo: false })
          .returning({ id: instituciones.id });
        await guardarSedePrincipal(tx, creada!.id, ubicacionDeLaSede);
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
        return creada!.id;
      });
    let nuevaId: string;
    try {
      nuevaId = await crear(await slugLibre(d.nombre));
    } catch (e) {
      // Otra institución tomó el mismo slug entre la consulta y el insert: se reintenta con un sufijo al azar.
      if (!esViolacionUnica(e)) throw e;
      nuevaId = await crear(`${slugify(d.nombre) || "institucion"}-${crypto.randomUUID().slice(0, 6)}`);
    }
    // Si entró por el enlace de otra institución (cookie de /referido/<código>), queda anotada como recomendada. Nunca frena el alta.
    await anotarReferidoDelNavegador({ id: nuevaId, nombre: d.nombre, propietarioId: usuario.id });
  }

  revalidatePath("/institucion", "layout");
  redirect(destinoDe(formData) === "salir" ? "/" : "/onboarding/institucion/3");
}

/**
 * La persona **acepta** la invitación al equipo (paso 2 del alta, con un toque). Una invitación nunca se activa sola. Los términos casi
 * siempre ya se aceptaron al registrarse; si la cuenta no tiene constancia (cuentas anteriores), se piden acá y se deja la constancia.
 */
export async function unirseAlEquipo(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await usuarioParaAlta("institucion");
  let terminosAceptadosEn = usuario.terminosAceptadosEn;
  if (!terminosAceptadosEn) {
    if (formData.get("aceptaTerminos") !== "on") {
      return conError(formData, "Revisá los campos marcados.", { aceptaTerminos: "Tenés que aceptar los términos y condiciones" });
    }
    await registrarAceptacionDeTerminos(usuario.id);
    terminosAceptadosEn = new Date();
  }
  const unida = await sumarseAlEquipo({ ...usuario, terminosAceptadosEn }, (await datosDeSesion())?.nombre);
  if (!unida) return conError(formData, "Esa invitación ya no está disponible. Pedile a quien te invitó que te mande otra.");

  revalidatePath("/institucion", "layout");
  redirect(RUTA_INICIO.institucion);
}

/**
 * La persona **rechaza** la invitación que se le muestra: se borra y se le avisa al equipo que invitó. Después vuelve al paso 2, que
 * muestra la siguiente invitación vigente (si hay otra) o el formulario para crear su propia institución.
 */
export async function rechazarInvitacionAlEquipo(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await usuarioParaAlta("institucion");
  const hecho = await rechazarInvitacion(usuario);
  if (!hecho) return conError(formData, "Esa invitación ya no está disponible.");
  revalidatePath("/institucion", "layout");
  redirect("/onboarding/institucion/2");
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

  // Quien se registró con email o con Google desde "Crear cuenta" ya aceptó los términos en el paso 1. Quien llegó con Google
  // desde "Ingresar" (sin cuenta) no pasó por esa casilla: los acepta acá, y el servidor lo exige antes de crear su perfil.
  const faltanTerminos = !usuario.terminosAceptadosEn && formData.get("aceptaTerminos") !== "on";
  const avisoDeTerminos: Record<string, string> = faltanTerminos ? { aceptaTerminos: "Tenés que aceptar los términos y condiciones" } : {};

  const r = parsear(categoriaDocenteSchema, {
    categoria: formData.get("categoria") ?? "",
    asignaturas: textos(formData, "asignaturas"),
    estudio: formData.get("estudio") ?? "",
  });
  if (!r.ok) return conError(formData, r.error, { ...r.campos, ...avisoDeTerminos });
  if (faltanTerminos) return conError(formData, "Revisá los campos marcados.", avisoDeTerminos);
  const { categoria, estudio } = r.data;
  const asignaturas = sinRepetidos(r.data.asignaturas);

  const validas = await nombresDeAsignaturas(categoria);
  if (asignaturas.some((a) => !validas.has(a))) {
    return conError(formData, "Revisá los campos marcados.", { asignaturas: "Elegí asignaturas de la lista de esa categoría." });
  }

  // Quien todavía estudia declara qué porcentaje de las materias aprobó (lo respalda la constancia de alumno regular).
  let porcentajeMaterias: number | null = null;
  if (estudio === "estudiante") {
    const lectura = leerPorcentaje(formData.get("porcentaje"));
    if (!lectura.ok) return conError(formData, "Revisá los campos marcados.", { porcentaje: lectura.error });
    porcentajeMaterias = lectura.valor;
  }

  const db = getDb();
  let docente = await docenteDeUsuario(usuario.id);
  if (docente?.onboardingCompleto) redirect(RUTA_INICIO.docente);

  if (!usuario.terminosAceptadosEn) await registrarAceptacionDeTerminos(usuario.id);

  if (docente) {
    await db.update(docentes).set({ categoria, asignaturas }).where(eq(docentes.id, docente.id));
  } else {
    const sesion = await datosDeSesion();
    const respaldo = usuario.email.split("@")[0] ?? "Profesional";
    // Con el registro por email el nombre y el apellido vienen separados (los escribió la persona); con Google, o en cuentas
    // anteriores, viene el nombre completo y se parte.
    const { nombre, apellido } = sesion?.apellido
      ? { nombre: sesion.nombre ?? respaldo, apellido: sesion.apellido }
      : partirNombre(sesion?.nombre ?? "", respaldo);
    const [creado] = await db
      .insert(docentes)
      .values({ usuarioId: usuario.id, nombre, apellido, email: usuario.email, categoria, asignaturas })
      .onConflictDoNothing()
      .returning({ id: docentes.id });
    docente = await docenteDeUsuario(usuario.id);
    if (!docente) return conError(formData, "No pudimos crear tu perfil. Probá de nuevo.");
    // La foto de la cuenta de Google se copia a nuestro Storage (no se guarda su dirección: esos datos los puede escribir cualquiera al
    // registrarse y apuntarían a un servidor ajeno). Si no se puede, el perfil queda sin foto y la persona sube una.
    if (creado && sesion?.fotoUrl) {
      const foto = await copiarFotoDeGoogle(usuario.id, sesion.fotoUrl);
      if (foto) await db.update(docentes).set({ fotoUrl: foto }).where(eq(docentes.id, docente.id));
    }
  }

  // Si cambió a "ya me recibí", la constancia de alumno regular que había subido ya no corresponde.
  const [previo] = await db.select({ documentos: docenteDetalle.documentos }).from(docenteDetalle).where(eq(docenteDetalle.docenteId, docente.id)).limit(1);
  const { constancia: constanciaPrevia, ...documentosSinConstancia } = previo?.documentos ?? {};
  const quitaConstancia = estudio === "recibido" && Boolean(constanciaPrevia);

  await db
    .insert(docenteDetalle)
    .values({ docenteId: docente.id, situacionEstudio: estudio, porcentajeMaterias })
    .onConflictDoUpdate({
      target: docenteDetalle.docenteId,
      set: {
        situacionEstudio: estudio,
        porcentajeMaterias,
        ...(quitaConstancia ? { documentos: documentosSinConstancia } : {}),
        actualizadoEn: new Date(),
      },
    });
  if (quitaConstancia) await borrarArchivos([constanciaPrevia]);

  revalidatePath("/docente", "layout");
  redirect(destinoDe(formData) === "salir" ? "/" : "/onboarding/docente/3");
}

/** "Tu perfil": datos personales y zonas. "Guardar borrador" guarda sin exigir los campos con asterisco. */
export async function guardarDatosDocente(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { docente } = await docenteEnAlta();
  const destino = destinoDe(formData);

  const r = parsear(datosDocenteSchema, {
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
      // El nombre y el apellido se piden al crear la cuenta y se corrigen en Mi perfil: este paso no los toca.
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

const DOCUMENTOS_DEL_ALTA = ["dniFrente", "dniDorso", "credencial", "constancia"] as const;

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
  // El DNI es lo que el equipo necesita para verificar a la persona: "Guardar borrador" o "Guardar y salir" en "Tu perfil" lo dejan pasar
  // sin él, así que no se cierra el alta hasta que esté.
  if (!detalle?.dni) redirect(`${rutaPasoDocente("3")}?falta=dni`);

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
