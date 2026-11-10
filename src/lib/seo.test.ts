import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  IMAGEN_DOCENTES,
  IMAGEN_GENERAL,
  IMAGEN_INSTITUCIONES,
  LIMITES,
  archivoDeImagen,
  metadatosDeAyuda,
  metadatosDeContenido,
  metadatosDePagina,
  paginaDeIngreso,
  PAGINAS,
  PUBLICOS,
  publicoDeArchivo,
  recortarDescripcion,
  rutaDeImagen,
  TEXTO_ALTERNATIVO,
  tituloDeGuia,
  textosDeInstitucion,
  textosDeOferta,
  tituloParaCompartir,
  type PaginaSeo,
} from "./seo";

const todas = Object.entries(PAGINAS) as [string, PaginaSeo][];

/** Palabras con las que una página dice a quién le habla (sin tildes ni mayúsculas). */
const SE_DIRIGE_A = {
  docentes: /trabaj|postul|cv\b/,
  instituciones: /institucion|colegio|club|natatorio|profesionales|publica/,
  general: /docente|institucion|profesional/,
} as const;
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

describe("textos de las páginas al compartirlas", () => {
  // Los textos de los documentos legales y de Quiénes somos los escribió el equipo y son más largos: WhatsApp los corta solo.
  const ESCRITAS_POR_EL_EQUIPO = ["terminos", "privacidad", "quienesSomos"];

  it("cada título y cada descripción entran en una vista previa", () => {
    for (const [clave, p] of todas) {
      const titulo = tituloParaCompartir(p);
      assert.ok(titulo.length <= LIMITES.titulo, `${clave}: el título «${titulo}» pasa de ${LIMITES.titulo} caracteres (${titulo.length})`);
      assert.ok(p.descripcion.length >= LIMITES.descripcionMin, `${clave}: la descripción es muy corta`);
      if (!ESCRITAS_POR_EL_EQUIPO.includes(clave)) {
        assert.ok(p.descripcion.length <= LIMITES.descripcionPagina, `${clave}: la descripción pasa de ${LIMITES.descripcionPagina} caracteres (${p.descripcion.length})`);
      }
    }
  });

  it("las páginas que les hablan a docentes o a instituciones lo dicen en el título", () => {
    for (const [clave, p] of todas) {
      if (p.publico === "general") continue;
      assert.match(sinTildes(p.titulo), SE_DIRIGE_A[p.publico], `${clave} (${p.publico}) no dice a quién le habla en el título «${p.titulo}»`);
    }
  });

  it("las páginas de entrada que sirven a los dos públicos nombran a los dos", () => {
    for (const clave of ["inicio", "registro", "ingresar", "contacto", "ayuda"] as const) {
      const texto = sinTildes(`${PAGINAS[clave].titulo} ${PAGINAS[clave].descripcion}`);
      assert.match(texto, /docente/, `${clave} no nombra a los docentes`);
      assert.match(texto, /institucion/, `${clave} no nombra a las instituciones`);
    }
  });

  it("una página para docentes no habla de publicar búsquedas y una para instituciones no promete trabajo", () => {
    for (const [clave, p] of todas) {
      const titulo = sinTildes(p.titulo);
      if (p.publico === "docentes") assert.doesNotMatch(titulo, /publica/, `${clave}: es para docentes pero el título invita a publicar`);
      if (p.publico === "instituciones") assert.doesNotMatch(titulo, /busca(?:.*)trabajo|postula/, `${clave}: es para instituciones pero el título habla de buscar trabajo`);
    }
  });

  it("el título que se comparte lleva la marca, salvo los que ya empiezan con ella", () => {
    for (const [clave, p] of todas) {
      const t = tituloParaCompartir(p);
      assert.ok(/UNIDOAR/.test(t), `${clave}: el título no nombra la marca`);
      if (p.absoluto) assert.ok(t.startsWith("UNIDOAR"), `${clave}: un título absoluto tiene que empezar con la marca`);
      else assert.ok(t.endsWith(" · UNIDOAR"), clave);
    }
  });

  it("no quedan dos páginas con el mismo título", () => {
    const vistos = new Map<string, string>();
    for (const [clave, p] of todas) {
      const t = tituloParaCompartir(p);
      assert.equal(vistos.has(t), false, `${clave} repite el título de ${vistos.get(t)}`);
      vistos.set(t, clave);
    }
  });

  it("cada ruta es una dirección interna sin parámetros", () => {
    for (const [clave, p] of todas) assert.match(p.ruta, /^\/[a-z0-9/-]*$/, clave);
  });
});

describe("metadatosDePagina", () => {
  it("arma título, descripción, canónica, openGraph y twitter completos", () => {
    const m = metadatosDePagina(PAGINAS.buscarTrabajo);
    assert.equal(m.title, PAGINAS.buscarTrabajo.titulo);
    assert.equal(m.description, PAGINAS.buscarTrabajo.descripcion);
    assert.deepEqual(m.alternates, { canonical: "/buscar-trabajo" });
    assert.equal(m.openGraph?.title, `${PAGINAS.buscarTrabajo.titulo} · UNIDOAR`);
    assert.equal(m.openGraph?.description, PAGINAS.buscarTrabajo.descripcion);
    assert.equal((m.openGraph as { url?: string }).url, "/buscar-trabajo");
    assert.equal((m.openGraph as { locale?: string }).locale, "es_AR");
    assert.equal((m.twitter as { card?: string }).card, "summary_large_image");
    assert.equal(m.twitter?.title, `${PAGINAS.buscarTrabajo.titulo} · UNIDOAR`);
  });

  it("un título absoluto no lleva el sufijo de la marca ni en la pestaña ni al compartir", () => {
    const m = metadatosDePagina(PAGINAS.inicio);
    assert.deepEqual(m.title, { absolute: PAGINAS.inicio.titulo });
    assert.equal(m.openGraph?.title, PAGINAS.inicio.titulo);
  });

  it("el contenido armado con datos (una oferta) puede ser un artículo", () => {
    const m = metadatosDeContenido({ publico: "docentes", titulo: "Oferta", descripcion: "Texto", ruta: "/ofertas/1" }, "article");
    assert.equal((m.openGraph as { type?: string }).type, "article");
  });
});

describe("ingreso según a dónde iba la persona", () => {
  it("un enlace al área de docentes habla de buscar trabajo", () => {
    assert.equal(paginaDeIngreso("/docente/oportunidades"), PAGINAS.ingresarDocentes);
    assert.equal(paginaDeIngreso("/docente/oferta/abc?x=1"), PAGINAS.ingresarDocentes);
    assert.equal(paginaDeIngreso("/docente"), PAGINAS.ingresarDocentes);
  });

  it("un enlace al área de instituciones habla de buscar profesionales", () => {
    assert.equal(paginaDeIngreso("/institucion/buscar-docentes"), PAGINAS.ingresarInstituciones);
    assert.equal(paginaDeIngreso("/institucion/postulantes?busqueda=9#x"), PAGINAS.ingresarInstituciones);
  });

  it("lo demás (incluso un nombre parecido) usa el ingreso general", () => {
    assert.equal(paginaDeIngreso(undefined), PAGINAS.ingresar);
    assert.equal(paginaDeIngreso("/inicio"), PAGINAS.ingresar);
    assert.equal(paginaDeIngreso("/docentes-falsos"), PAGINAS.ingresar);
    assert.equal(paginaDeIngreso("/institucional"), PAGINAS.ingresar);
    assert.equal(paginaDeIngreso("/backoffice/cobros"), PAGINAS.ingresar);
  });
});

describe("ofertas e instituciones compartidas", () => {
  it("una oferta abierta se presenta como oferta de trabajo, con su resumen", () => {
    const t = textosDeOferta({ puesto: "Profesor de Educación Física", institucion: "Colegio San Andrés", resumen: "Cubrimos una suplencia.", abierta: true });
    assert.equal(t.titulo, "Oferta de trabajo: Profesor de Educación Física · Colegio San Andrés");
    assert.equal(t.descripcion, "Cubrimos una suplencia.");
  });

  it("una oferta que se cerró lo dice, sin contar el detalle", () => {
    const t = textosDeOferta({ puesto: "Preceptor", institucion: "Colegio", resumen: "Detalle privado", abierta: false });
    assert.equal(t.descripcion, "Esta búsqueda ya no está abierta.");
  });

  it("el perfil de una institución invita a ver sus búsquedas y postularse", () => {
    const t = textosDeInstitucion({ nombre: "Club Ribera", tipo: "Club", descripcion: null });
    assert.equal(t.titulo, "Club Ribera · Mirá sus búsquedas y postulate");
    assert.match(t.descripcion, /^Club en UNIDOAR\./);
  });

  it("la descripción larga de una institución se corta en una palabra", () => {
    const larga = "Somos un club con muchos años de historia ".repeat(10);
    const t = textosDeInstitucion({ nombre: "Club", tipo: "Club", descripcion: larga });
    assert.ok(t.descripcion.length <= LIMITES.descripcion, String(t.descripcion.length));
    assert.ok(t.descripcion.endsWith("…"));
    assert.ok(!/\s…$/.test(t.descripcion));
  });
});

describe("Centro de ayuda", () => {
  it("el título de una guía dice para quién es el manual", () => {
    assert.equal(tituloDeGuia("profesionales", "Crear tu cuenta"), "Crear tu cuenta · Ayuda para profesionales");
    assert.equal(tituloDeGuia("instituciones", "Publicar una búsqueda"), "Publicar una búsqueda · Ayuda para instituciones");
  });

  it("el manual de profesionales le habla a docentes y el de instituciones a instituciones, también en la imagen", () => {
    const pro = metadatosDeAyuda({ manual: "profesionales", titulo: "Manual para profesionales", descripcion: "Guías.", ruta: "/ayuda/profesionales" });
    const inst = metadatosDeAyuda({ manual: "instituciones", titulo: "Manual para instituciones", descripcion: "Guías.", ruta: "/ayuda/instituciones" });
    assert.equal((pro.openGraph as { images: { url: string }[] }).images[0].url, rutaDeImagen("docentes"));
    assert.equal((inst.openGraph as { images: { url: string }[] }).images[0].url, rutaDeImagen("instituciones"));
    assert.equal((pro.openGraph as { url?: string }).url, "/ayuda/profesionales");
  });
});

describe("recortarDescripcion", () => {
  it("deja una sola línea y no toca lo que entra", () => {
    assert.equal(recortarDescripcion("  Hola\n\n  mundo  "), "Hola mundo");
  });

  it("corta en el límite sin partir una palabra", () => {
    const r = recortarDescripcion("palabra ".repeat(40), 50);
    assert.ok(r.length <= 50);
    assert.ok(r.endsWith("palabra…"));
  });
});

describe("las imágenes de cada público", () => {
  it("la de docentes y la de instituciones dicen a quién le hablan", () => {
    assert.match(IMAGEN_DOCENTES.pastilla, /DOCENTES/);
    assert.match(IMAGEN_INSTITUCIONES.pastilla, /INSTITUCIONES/);
    assert.match(sinTildes(IMAGEN_DOCENTES.titulo), /trabajo/);
    assert.match(sinTildes(IMAGEN_INSTITUCIONES.titulo), /profesionales/);
  });

  it("la general muestra a los dos públicos", () => {
    assert.deepEqual(
      IMAGEN_GENERAL.tarjetas.map((t) => t.pastilla),
      [IMAGEN_DOCENTES.pastilla, IMAGEN_INSTITUCIONES.pastilla],
    );
  });

  it("las fotos existen", () => {
    for (const c of [IMAGEN_DOCENTES, IMAGEN_INSTITUCIONES]) assert.ok(existsSync(join(process.cwd(), "public", "assets", c.foto)), c.foto);
  });
});

describe("la imagen de cada página", () => {
  it("cada página declara la imagen de su público, con medidas y texto alternativo", () => {
    for (const [clave, p] of todas) {
      const m = metadatosDePagina(p);
      for (const imagenes of [(m.openGraph as { images?: unknown[] }).images, (m.twitter as { images?: unknown[] }).images]) {
        assert.equal(imagenes?.length, 1, clave);
        const img = imagenes![0] as { url: string; width: number; height: number; alt: string };
        assert.equal(img.url, rutaDeImagen(p.publico), clave);
        assert.deepEqual([img.width, img.height], [1200, 630], clave);
        assert.equal(img.alt, TEXTO_ALTERNATIVO[p.publico], clave);
      }
    }
  });

  it("la dirección de la imagen lleva la versión y termina en .png antes del parámetro", () => {
    for (const publico of PUBLICOS) assert.equal(rutaDeImagen(publico).startsWith(`/og/${publico}.png?v=`), true, publico);
    for (const publico of PUBLICOS) assert.match(rutaDeImagen(publico), /^\/og\/[a-z]+\.png\?v=\w+$/, publico);
  });

  it("el archivo de la ruta /og se traduce al público y de vuelta", () => {
    for (const publico of PUBLICOS) assert.equal(publicoDeArchivo(archivoDeImagen(publico)), publico);
    assert.equal(publicoDeArchivo("docentes"), null, "sin extensión");
    assert.equal(publicoDeArchivo("otra.png"), null);
    assert.equal(publicoDeArchivo("../docentes.png"), null);
    assert.equal(publicoDeArchivo(""), null);
  });

  it("el texto alternativo de cada imagen dice a quién le habla", () => {
    assert.match(TEXTO_ALTERNATIVO.docentes, /docentes/);
    assert.match(TEXTO_ALTERNATIVO.instituciones, /instituciones/);
    assert.match(TEXTO_ALTERNATIVO.general, /docentes/);
    assert.match(TEXTO_ALTERNATIVO.general, /instituciones/);
  });

  it("la ruta /og sirve los tres públicos y no deja pasar otros", () => {
    const ruta = readFileSync(join(process.cwd(), "src/app/og/[archivo]/route.tsx"), "utf8");
    assert.match(ruta, /generateStaticParams/);
    assert.match(ruta, /dynamicParams = false/);
    assert.match(ruta, /PUBLICOS.map/);
  });

  it("no quedan opengraph-image por carpeta (una página con su propio openGraph los perdería)", () => {
    const hay = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? hay(join(dir, e.name)) : /^opengraph-image./.test(e.name) ? [join(dir, e.name)] : [],
      );
    assert.deepEqual(hay(join(process.cwd(), "src/app")), []);
  });
});
