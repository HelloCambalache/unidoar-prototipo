/*
 * Vincula cuentas REALES de Supabase Auth con datos de ejemplo, para poder probar la app con contenido:
 *
 *   pnpm db:vincular --institucion=correo@institucion.com --docente=correo@docente.com
 *
 * - La cuenta de institución queda como dueña de "Colegio San Andrés del Norte" (con sus búsquedas y postulantes).
 * - La cuenta de docente queda como "Luciana Prieto" (con sus postulaciones).
 * - Ambas reciben notificaciones de ejemplo.
 *
 * No crea cuentas: las cuentas se crean en Supabase (panel o /registro). Es idempotente. Hay que volver a
 * correrlo después de `pnpm db:seed`, porque el seed recrea los datos demo y suelta el vínculo.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { urlMigraciones } from "./conexion";
import * as s from "./schema";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la conexión a la base (corré el script con dotenv: pnpm db:vincular).");
  process.exit(1);
}
const cliente = postgres(url, { max: 1 });
const db = drizzle(cliente, { schema: s });

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const i = a.indexOf("=");
      return i < 0 ? [a.slice(2), "true"] : [a.slice(2, i), a.slice(i + 1)];
    }),
);

const MIN = 60_000;
const HORA = 3_600_000;
const DIA = 86_400_000;
const hace = (ms: number) => new Date(Date.now() - ms);

async function idDeCuenta(email: string) {
  const filas = await db.execute<{ id: string }>(sql`select id from auth.users where lower(email) = lower(${email}) limit 1`);
  const id = filas[0]?.id;
  if (!id) throw new Error(`No existe ninguna cuenta de Supabase con el correo ${email}. Crearla primero en Authentication → Users.`);
  return id;
}

async function asegurarUsuario(id: string, email: string, rol: "institucion" | "docente") {
  await db
    .insert(s.usuarios)
    .values({ id, email, rol })
    .onConflictDoUpdate({ target: s.usuarios.id, set: { email, rol } });
}

async function vincularInstitucion(email: string) {
  const id = await idDeCuenta(email);
  await asegurarUsuario(id, email, "institucion");

  const [inst] = await db.select().from(s.instituciones).where(eq(s.instituciones.slug, "sanandres")).limit(1);
  if (!inst) throw new Error('No existe la institución demo "sanandres": corré primero pnpm db:seed.');

  await db
    .update(s.instituciones)
    .set({
      propietarioId: id,
      contactoNombre: "Cuenta de prueba",
      contactoRol: "Director/a",
      telefono: "11 5142-8830",
    })
    .where(eq(s.instituciones.id, inst.id));

  await db.delete(s.institucionMiembros).where(eq(s.institucionMiembros.institucionId, inst.id));
  await db.insert(s.institucionMiembros).values([
    { institucionId: inst.id, usuarioId: id, email, nombre: "Cuenta de prueba", rol: "dueno", estado: "activo" },
    {
      institucionId: inst.id,
      email: "veronica.maidana@ejemplo.unidoar.test",
      nombre: "Verónica Maidana",
      rol: "administrador",
      estado: "activo",
    },
  ]);

  const busqueda = async (puesto: string) => {
    const [b] = await db
      .select({ id: s.busquedas.id })
      .from(s.busquedas)
      .where(and(eq(s.busquedas.institucionId, inst.id), eq(s.busquedas.puesto, puesto)))
      .limit(1);
    return b?.id;
  };
  const edFisica = await busqueda("Ed. Física — Primario");
  const mate = await busqueda("Suplencia Matemática");
  const inicial = await busqueda("Maestra Nivel Inicial");

  await db.delete(s.notificaciones).where(eq(s.notificaciones.usuarioId, id));
  await db.insert(s.notificaciones).values([
    { usuarioId: id, tipo: "postulacion", titulo: "Martina Alsina", texto: "se postuló a Ed. Física — Primario.", enlace: edFisica && `/institucion/postulantes?busqueda=${edFisica}`, leida: false, creadoEn: hace(5 * MIN) },
    { usuarioId: id, tipo: "postulacion", titulo: "Luciana Prieto", texto: "fue invitada a Maestra Nivel Inicial.", enlace: inicial && `/institucion/postulantes?busqueda=${inicial}`, leida: false, creadoEn: hace(40 * MIN) },
    { usuarioId: id, tipo: "urgente", titulo: "Suplencia Matemática", texto: "vence en 18 hs. Revisá los postulantes.", enlace: mate && `/institucion/postulantes?busqueda=${mate}`, leida: false, creadoEn: hace(2 * HORA) },
    { usuarioId: id, tipo: "verificacion", titulo: "Nicolás Bravo", texto: "subió su título docente.", enlace: null, leida: true, creadoEn: hace(1 * DIA) },
    { usuarioId: id, tipo: "sistema", titulo: "UNIDOAR", texto: "tu plan Colegios está activo.", enlace: "/institucion/plan", leida: true, creadoEn: hace(1 * DIA + HORA) },
  ]);

  console.log(`✓ institución: ${email} → dueña de "${inst.nombre}" (+ equipo y 5 notificaciones)`);
}

async function vincularDocente(email: string) {
  const id = await idDeCuenta(email);
  await asegurarUsuario(id, email, "docente");

  // usuario_id es único: soltar cualquier perfil anterior de esta cuenta antes de asignarla.
  await db.update(s.docentes).set({ usuarioId: null }).where(eq(s.docentes.usuarioId, id));
  const [luciana] = await db
    .select()
    .from(s.docentes)
    .where(and(eq(s.docentes.nombre, "Luciana"), eq(s.docentes.apellido, "Prieto"), eq(s.docentes.esDemo, true)))
    .limit(1);
  if (!luciana) throw new Error('No existe el docente demo "Luciana Prieto": corré primero pnpm db:seed.');
  await db.update(s.docentes).set({ usuarioId: id, email }).where(eq(s.docentes.id, luciana.id));

  const postulacion = async (puesto: string) => {
    const [p] = await db
      .select({ id: s.postulaciones.id, busquedaId: s.postulaciones.busquedaId })
      .from(s.postulaciones)
      .innerJoin(s.busquedas, eq(s.busquedas.id, s.postulaciones.busquedaId))
      .where(and(eq(s.postulaciones.docenteId, luciana.id), eq(s.busquedas.puesto, puesto)))
      .limit(1);
    return p;
  };
  const invitacion = await postulacion("Maestra Nivel Inicial");
  const entrevista = await postulacion("Natación — escuela de verano");
  const [mate] = await db
    .select({ id: s.busquedas.id })
    .from(s.busquedas)
    .where(inArray(s.busquedas.puesto, ["Suplencia Matemática"]))
    .limit(1);

  await db.delete(s.notificaciones).where(eq(s.notificaciones.usuarioId, id));
  await db.insert(s.notificaciones).values([
    { usuarioId: id, tipo: "invitacion", titulo: "Colegio San Andrés del Norte", texto: "te invitó a postularte a Maestra Nivel Inicial.", enlace: invitacion && `/docente/oferta/${invitacion.busquedaId}`, leida: false, creadoEn: hace(2 * MIN) },
    { usuarioId: id, tipo: "entrevista", titulo: "Club Atlético Ribera", texto: "agendó una entrevista para el jueves a las 16 hs.", enlace: entrevista && `/docente/postulaciones?abrir=${entrevista.id}`, leida: false, creadoEn: hace(1 * HORA) },
    { usuarioId: id, tipo: "urgente", titulo: "Suplencia urgente", texto: "Matemática en Vicente López, hay que responder en 18 hs.", enlace: mate && `/docente/oferta/${mate.id}`, leida: false, creadoEn: hace(3 * HORA) },
    { usuarioId: id, tipo: "vista", titulo: "Jardín Los Aromos", texto: "vio tu perfil.", enlace: "/docente/instituciones/aromos", leida: true, creadoEn: hace(1 * DIA) },
    { usuarioId: id, tipo: "sistema", titulo: "UNIDOAR", texto: "te damos la bienvenida. Completá tu perfil para recibir más invitaciones.", enlace: "/docente/perfil", leida: true, creadoEn: hace(1 * DIA + HORA) },
  ]);

  console.log(`✓ docente: ${email} → perfil de "${luciana.nombre} ${luciana.apellido}" (+ 5 notificaciones)`);
}

async function main() {
  if (!args.institucion && !args.docente) {
    console.error("Uso: pnpm db:vincular --institucion=correo --docente=correo");
    process.exitCode = 1;
    return;
  }
  if (args.institucion) await vincularInstitucion(args.institucion);
  if (args.docente) await vincularDocente(args.docente);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => cliente.end());
