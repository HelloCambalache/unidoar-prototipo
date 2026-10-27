import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { partesDeTexto } from "@/lib/terminos-texto";
import {
  articulosDe,
  articuloPorSlug,
  buscarEnAyuda,
  esPerfilPublico,
  MANUALES,
  MANUALES_PUBLICOS,
  rutaDeArticulo,
  rutaDeManual,
  textoDeBloques,
  vecinosDe,
  type BloqueDeAyuda,
  type ManualDeAyuda,
} from "@/lib/ayuda";

const TODOS = Object.values(MANUALES);

/* ───────── Las rutas que existen de verdad, leídas de src/app (para que un enlace del manual no quede roto) ───────── */

const RAIZ_APP = join(process.cwd(), "src", "app");

function paginas(dir: string, segmentos: string[] = []): string[][] {
  const salida: string[][] = [];
  for (const nombre of readdirSync(dir)) {
    const completo = join(dir, nombre);
    if (statSync(completo).isDirectory()) {
      // Los grupos de rutas "(publico)" no suman un tramo a la dirección; las carpetas privadas "_x" ni son rutas.
      if (nombre.startsWith("_")) continue;
      salida.push(...paginas(completo, nombre.startsWith("(") ? segmentos : [...segmentos, nombre]));
    } else if (nombre === "page.tsx" || nombre === "route.ts") {
      salida.push(segmentos);
    }
  }
  return salida;
}

const RUTAS = paginas(RAIZ_APP);

function existeLaRuta(href: string): boolean {
  const tramos = href.split(/[?#]/)[0]!.split("/").filter(Boolean);
  return RUTAS.some((ruta) => ruta.length === tramos.length && ruta.every((t, i) => /^\[.+\]$/.test(t) || t === tramos[i]));
}

/** Todos los textos de un manual (bloques de las guías y de las preguntas) para revisarlos. */
function bloquesDe(manual: ManualDeAyuda): BloqueDeAyuda[][] {
  return [...articulosDe(manual).map((a) => a.bloques), ...manual.preguntas.map((p) => p.respuesta)];
}

const textosDe = (bloques: BloqueDeAyuda[]) =>
  bloques.flatMap((b) => ("p" in b ? [b.p] : "nota" in b ? [b.nota] : "pasos" in b ? b.pasos : b.lista));

describe("centro de ayuda: contenido", () => {
  it("hay un manual por perfil y el del equipo no es público", () => {
    assert.deepEqual(Object.keys(MANUALES).sort(), ["equipo", "instituciones", "profesionales"]);
    assert.deepEqual(MANUALES_PUBLICOS.map((m) => m.perfil), ["profesionales", "instituciones"]);
    assert.equal(esPerfilPublico("profesionales"), true);
    assert.equal(esPerfilPublico("equipo"), false);
    assert.equal(esPerfilPublico("constructor"), false);
    assert.equal(rutaDeManual("equipo"), "/backoffice/ayuda");
    assert.equal(rutaDeArticulo("instituciones", "tu-equipo"), "/ayuda/instituciones/tu-equipo");
  });

  for (const manual of TODOS) {
    describe(`manual de ${manual.perfil}`, () => {
      it("tiene capítulos, guías y preguntas frecuentes, y cada guía dice algo", () => {
        assert.ok(manual.capitulos.length >= 3, "al menos tres capítulos");
        assert.ok(manual.preguntas.length >= 5, "al menos cinco preguntas");
        for (const capitulo of manual.capitulos) assert.ok(capitulo.articulos.length > 0, `capítulo vacío: ${capitulo.titulo}`);
        for (const a of articulosDe(manual)) {
          assert.ok(a.titulo.trim() && a.resumen.trim(), `guía sin título o resumen: ${a.slug}`);
          assert.ok(a.bloques.length >= 2, `guía casi vacía: ${a.slug}`);
        }
        for (const p of manual.preguntas) assert.ok(p.pregunta.endsWith("?") && p.respuesta.length > 0, `pregunta mal armada: ${p.pregunta}`);
      });

      it("las direcciones de las guías son únicas y válidas, y los títulos no se repiten", () => {
        const slugs = articulosDe(manual).map((a) => a.slug);
        assert.equal(new Set(slugs).size, slugs.length, "slugs repetidos");
        for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/, `slug inválido: ${s}`);
        const titulos = articulosDe(manual).map((a) => a.titulo);
        assert.equal(new Set(titulos).size, titulos.length, "títulos repetidos");
        const preguntas = manual.preguntas.map((p) => p.pregunta);
        assert.equal(new Set(preguntas).size, preguntas.length, "preguntas repetidas");
      });

      it("ningún texto deja marcas sueltas ni listas vacías", () => {
        for (const bloques of bloquesDe(manual)) {
          for (const b of bloques) {
            if ("pasos" in b) assert.ok(b.pasos.length > 0, "lista de pasos vacía");
            if ("lista" in b) assert.ok(b.lista.length > 0, "lista vacía");
          }
          for (const t of textosDe(bloques)) {
            assert.ok(t.trim().length > 0, "texto vacío");
            const sinMarcas = partesDeTexto(t)
              .filter((p) => p.tipo !== "enlace")
              .map((p) => p.texto)
              .join("");
            assert.ok(!sinMarcas.includes("**"), `negrita sin cerrar: ${t.slice(0, 60)}`);
            assert.ok(!/\]\(/.test(sinMarcas), `enlace mal escrito: ${t.slice(0, 60)}`);
          }
        }
      });

      it("todos los enlaces van a una página del sitio que existe, y a las guías que existen", () => {
        for (const bloques of bloquesDe(manual)) {
          for (const t of textosDe(bloques)) {
            for (const parte of partesDeTexto(t)) {
              if (parte.tipo !== "enlace") continue;
              assert.ok(existeLaRuta(parte.href), `el enlace «${parte.texto}» va a ${parte.href}, que no es una página`);
              const guia = /^\/ayuda\/(profesionales|instituciones)\/([^/?#]+)$/.exec(parte.href) ?? /^\/backoffice\/ayuda\/([^/?#]+)$/.exec(parte.href);
              if (guia) {
                const perfil = guia.length === 3 ? (guia[1] as "profesionales" | "instituciones") : "equipo";
                const slug = guia[guia.length - 1]!;
                assert.ok(articuloPorSlug(MANUALES[perfil], slug), `el enlace ${parte.href} no lleva a ninguna guía`);
              }
            }
          }
        }
      });

      it("el sitio público no manda a un manual interno", () => {
        if (manual.perfil === "equipo") return;
        for (const bloques of bloquesDe(manual)) {
          for (const t of textosDe(bloques)) {
            for (const parte of partesDeTexto(t)) {
              if (parte.tipo === "enlace") assert.ok(!parte.href.startsWith("/backoffice"), `enlace al backoffice en un manual público: ${parte.href}`);
            }
          }
        }
      });
    });
  }

  it("las guías de profesionales no hablan de «docentes» como persona (se dice profesional)", () => {
    // La categoría «Docente» sí existe como nombre de un cargo; lo que no va es llamar docente a quien busca trabajo en general.
    for (const manual of [MANUALES.profesionales, MANUALES.instituciones]) {
      for (const bloques of bloquesDe(manual)) {
        for (const t of textosDe(bloques)) assert.ok(!/\bdocentes? (que busca|que se postula)/i.test(t), `llama docente a un profesional: ${t.slice(0, 80)}`);
      }
    }
  });
});

describe("centro de ayuda: recorrido", () => {
  const manual = MANUALES.profesionales;

  it("encuentra una guía por su slug y devuelve su capítulo", () => {
    const r = articuloPorSlug(manual, "postularte");
    assert.equal(r?.articulo.slug, "postularte");
    assert.equal(r?.capitulo.id, "buscar-trabajo");
    assert.equal(articuloPorSlug(manual, "no-existe"), null);
    assert.equal(articuloPorSlug(manual, "constructor"), null);
  });

  it("anterior y siguiente siguen el orden de lectura, y en los extremos faltan", () => {
    const todos = articulosDe(manual);
    const primero = todos[0]!;
    const ultimo = todos[todos.length - 1]!;
    assert.equal(vecinosDe(manual, primero.slug).anterior, null);
    assert.equal(vecinosDe(manual, primero.slug).siguiente?.slug, todos[1]!.slug);
    assert.equal(vecinosDe(manual, ultimo.slug).siguiente, null);
    assert.equal(vecinosDe(manual, ultimo.slug).anterior?.slug, todos[todos.length - 2]!.slug);
    assert.deepEqual(vecinosDe(manual, "no-existe"), { anterior: null, siguiente: null });
  });
});

describe("centro de ayuda: búsqueda", () => {
  it("encuentra sin importar mayúsculas ni tildes, y pone primero lo que coincide en el título", () => {
    const r = buscarEnAyuda(MANUALES_PUBLICOS, "VERIFICACION");
    assert.ok(r.length > 0);
    assert.ok(r[0]!.titulo.toLowerCase().includes("verific"), "lo primero lleva la palabra en el título");
    assert.ok(r.every((x) => x.href.startsWith("/ayuda/")));
  });

  it("cada palabra tiene que estar: más palabras, menos resultados", () => {
    const una = buscarEnAyuda(MANUALES_PUBLICOS, "postulacion");
    const dos = buscarEnAyuda(MANUALES_PUBLICOS, "postulacion retirar");
    assert.ok(dos.length > 0 && dos.length <= una.length);
    assert.deepEqual(buscarEnAyuda(MANUALES_PUBLICOS, "zzzxyzz"), []);
  });

  it("una consulta vacía o de una letra no devuelve nada", () => {
    assert.deepEqual(buscarEnAyuda(MANUALES_PUBLICOS, ""), []);
    assert.deepEqual(buscarEnAyuda(MANUALES_PUBLICOS, "   "), []);
    assert.deepEqual(buscarEnAyuda(MANUALES_PUBLICOS, "a"), []);
  });

  it("las preguntas frecuentes también aparecen, y llevan a su sección", () => {
    const r = buscarEnAyuda([MANUALES.profesionales], "cuanto cuesta");
    const pregunta = r.find((x) => x.tipo === "pregunta");
    assert.ok(pregunta, "aparece la pregunta de cuánto cuesta");
    assert.equal(pregunta!.href, "/ayuda/profesionales#preguntas");
  });

  it("el sitio público no filtra el manual del equipo", () => {
    const r = buscarEnAyuda(MANUALES_PUBLICOS, "procesar baja");
    assert.ok(r.every((x) => x.perfil !== "equipo"));
    const interno = buscarEnAyuda(TODOS, "procesar baja");
    assert.ok(interno.some((x) => x.perfil === "equipo"));
  });

  it("el texto de una guía se lee sin las marcas", () => {
    assert.equal(textoDeBloques([{ p: "Entrá a [Mi perfil](/docente/perfil) y tocá **Guardar**." }, { lista: ["uno", "**dos**"] }]), "Entrá a Mi perfil y tocá Guardar. uno dos");
  });

  it("limita la cantidad de resultados y de palabras", () => {
    const r = buscarEnAyuda(TODOS, "de");
    assert.ok(r.length <= 24);
  });
});
