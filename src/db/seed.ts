/*
 * Siembra: catálogos reales + datos de ejemplo (es_demo = true).
 * Se puede correr las veces que haga falta: borra y recrea solo lo demo.
 *
 *   pnpm db:seed          → catálogos + demo
 *   pnpm db:seed --solo-catalogos
 *   pnpm db:seed --borrar-demo
 */
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { urlMigraciones } from "./conexion";
import * as s from "./schema";
import {
  BUSQUEDAS,
  CATALOGO_ASIGNATURAS,
  CURSOS,
  DOCENTES,
  FACTURAS,
  INSTITUCIONES,
  NOVEDADES,
  POSTULACIONES,
  TESTIMONIOS,
  ZONAS,
} from "./seed-data";

// Conexión directa / pooler de sesión: el seed hace muchas escrituras seguidas.
const url = urlMigraciones();
if (!url) {
  console.error("Falta POSTGRES_URL_NON_POOLING / POSTGRES_URL (corré el script con dotenv: pnpm db:seed).");
  process.exit(1);
}
const cliente = postgres(url, { max: 1 });
const db = drizzle(cliente, { schema: s });

const DIA = 86_400_000;
const HORA = 3_600_000;
const args = new Set(process.argv.slice(2));

async function catalogos() {
  await db
    .insert(s.zonas)
    .values(ZONAS.map(([nombre, partido, provincia, lat, lng], orden) => ({ nombre, partido, provincia, lat, lng, orden })))
    .onConflictDoNothing();

  const filas = (Object.keys(CATALOGO_ASIGNATURAS) as s.CategoriaDocente[]).flatMap((categoria) =>
    CATALOGO_ASIGNATURAS[categoria].flatMap((g, gi) =>
      g.items.map((nombre, i) => ({ categoria, rubro: g.rubro, nombre, orden: gi * 100 + i })),
    ),
  );
  await db.insert(s.asignaturas).values(filas).onConflictDoNothing();

  const [{ n }] = await db.select({ n: count() }).from(s.testimonios);
  if (n === 0) {
    await db.insert(s.testimonios).values(TESTIMONIOS.map((t, orden) => ({ ...t, orden })));
  }
  console.log(`✓ catálogos: ${ZONAS.length} zonas, ${filas.length} asignaturas`);
}

async function borrarDemo() {
  // Las búsquedas, postulaciones y cursos caen en cascada con la institución / el docente.
  await db.delete(s.instituciones).where(eq(s.instituciones.esDemo, true));
  await db.delete(s.docentes).where(eq(s.docentes.esDemo, true));
  console.log("✓ demo anterior borrado");
}

async function demo() {
  const coordsZona = new Map(ZONAS.map(([n, , , lat, lng]) => [n, { lat, lng }]));
  const ahora = Date.now();

  const insts = await db
    .insert(s.instituciones)
    .values(
      INSTITUCIONES.map((i) => {
        const c = coordsZona.get(i.zona);
        return {
          slug: i.slug,
          nombre: i.nombre,
          tipo: i.tipo,
          fundada: i.fundada,
          direccion: i.direccion,
          partido: i.partido,
          provincia: "Buenos Aires",
          zona: i.zonaTexto ?? i.zona,
          lat: c?.lat,
          lng: c?.lng,
          logoUrl: i.logoUrl,
          portadaUrl: i.portadaUrl,
          descripcion: i.descripcion,
          alumnos: i.alumnos,
          niveles: i.niveles,
          turnos: i.turnos,
          docentesPlanta: i.docentesPlanta,
          verificada: i.verificada,
          mision: i.mision,
          vision: i.vision,
          valores: i.valores ?? [],
          horarioAdministracion: i.horarioAdministracion,
          plan: i.plan ?? "fundador",
          medioPago: i.medioPago,
          diaCobro: i.diaCobro,
          condicionFiscal: i.condicionFiscal,
          cuit: i.cuit,
          esDemo: true,
        };
      }),
    )
    .returning({ id: s.instituciones.id, slug: s.instituciones.slug, zona: s.instituciones.zona });
  const instId = new Map(insts.map((i) => [i.slug, i.id]));

  await db.insert(s.institucionNovedades).values(
    NOVEDADES.map((n) => ({ institucionId: instId.get(n.inst)!, fecha: n.fecha, titulo: n.titulo, texto: n.texto })),
  );
  await db.insert(s.facturas).values(
    FACTURAS.map((f) => ({
      institucionId: instId.get(f.inst)!,
      plan: f.plan,
      monto: f.monto,
      periodo: f.periodo,
      fechaCobro: f.fechaCobro,
      estado: f.estado,
      medio: f.medio,
      pagadaEn: f.estado === "pagada" ? new Date(f.fechaCobro + "T12:00:00Z") : null,
    })),
  );
  const instZona = new Map(insts.map((i) => [i.slug, i.zona]));

  const docs = await db
    .insert(s.docentes)
    .values(
      DOCENTES.map((d) => {
        const c = coordsZona.get(d.zonas[0]!);
        return {
          nombre: d.nombre,
          apellido: d.apellido,
          categoria: d.categoria,
          subtitulo: d.subtitulo,
          resumen: d.resumen,
          experiencia: d.experiencia ?? [],
          formacion: d.formacion ?? [],
          fotoUrl: d.fotoUrl,
          telefono: d.telefono,
          email: `${d.nombre}.${d.apellido}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z.]/g, "") + "@ejemplo.unidoar.test",
          zonas: d.zonas,
          asignaturas: d.asignaturas,
          disponibilidad: d.disponibilidad,
          niveles: d.niveles,
          lat: c?.lat,
          lng: c?.lng,
          aniosExperiencia: d.anios,
          verificacion: d.verificado ? ("verificado" as const) : ("pendiente" as const),
          tituloVerificado: d.verificado,
          antecedentesVerificados: d.verificado,
          onboardingCompleto: true,
          esDemo: true,
        };
      }),
    )
    .returning({ id: s.docentes.id, nombre: s.docentes.nombre, apellido: s.docentes.apellido });
  const docKey = new Map(DOCENTES.map((d, i) => [d.key, docs[i]!.id]));

  const buscs = await db
    .insert(s.busquedas)
    .values(
      BUSQUEDAS.map((b) => ({
        institucionId: instId.get(b.inst)!,
        puesto: b.puesto,
        categoria: b.categoria,
        disciplina: b.disciplina,
        nivel: b.nivel,
        tipo: b.tipo,
        rapida: b.rapida ?? false,
        cargaHoraria: b.cargaHoraria,
        turno: b.turno,
        horario: b.horario,
        fechaInicio: b.inicio,
        zona: instZona.get(b.inst),
        descripcion: b.descripcion,
        requisitos: b.requisitos,
        beneficios: b.beneficios,
        estado: b.estado ?? ("activa" as const),
        venceEn: b.venceEnHoras ? new Date(ahora + b.venceEnHoras * HORA) : null,
        cerradaEn: b.estado === "cerrada" ? new Date(ahora - 10 * DIA) : null,
        creadoEn: new Date(ahora - b.hace * DIA),
      })),
    )
    .returning({ id: s.busquedas.id });
  const busqKey = new Map(BUSQUEDAS.map((b, i) => [b.key, buscs[i]!.id]));

  await db.insert(s.postulaciones).values(
    POSTULACIONES.map((p) => {
      const desde = new Date(ahora - p.dias * DIA);
      return {
        busquedaId: busqKey.get(p.busqueda)!,
        docenteId: docKey.get(p.docente)!,
        etapa: p.etapa,
        origen: p.invitacion ? ("invitacion" as const) : ("postulacion" as const),
        entrevistaTitulo: p.etapa === "entrevista" ? p.nota : null,
        creadoEn: new Date(desde.getTime() - DIA),
        etapaDesde: desde,
      };
    }),
  );

  const cursos = await db
    .insert(s.cursos)
    .values(
      CURSOS.map((c) => ({
        institucionId: instId.get(c.inst)!,
        titulo: c.titulo,
        subtitulo: c.subtitulo,
        descripcion: c.descripcion,
        modalidad: c.modalidad,
        profesor: c.profesor,
        fechaInicio: c.fechaInicio,
        fechaFinal: c.fechaFinal,
        horario: c.horario,
        link: c.link,
        certifica: c.certifica,
        puntaje: c.puntaje,
        fotoUrl: c.fotoUrl,
      })),
    )
    .returning({ id: s.cursos.id });
  const inscripciones = CURSOS.flatMap((c, i) =>
    c.inscriptos.map((d) => ({ cursoId: cursos[i]!.id, docenteId: docKey.get(d)! })),
  );
  if (inscripciones.length) await db.insert(s.inscripcionesCurso).values(inscripciones);

  console.log(
    `✓ demo: ${insts.length} instituciones, ${docs.length} docentes, ${buscs.length} búsquedas, ${POSTULACIONES.length} postulaciones, ${cursos.length} cursos`,
  );
}

async function main() {
  await catalogos();
  if (args.has("--solo-catalogos")) return;
  await borrarDemo();
  if (args.has("--borrar-demo")) return;
  await demo();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cliente.end());
