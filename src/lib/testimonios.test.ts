import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PAGINA_TESTIMONIOS } from "@/lib/publico";
import {
  etiquetaDePagina,
  fotoAceptada,
  hayLugarEnPagina,
  LARGO_DE_CITA,
  limpiarCita,
  MAX_TESTIMONIOS_POR_PAGINA,
  PAGINAS_DE_TESTIMONIOS,
  siguienteOrden,
  testimonioSchema,
} from "@/lib/testimonios";

const valido = { pagina: "home", cita: "Cubrimos una licencia en dos días.", autor: "Marina Costa", cargo: "Vicedirectora · Colegio X" };

describe("testimonios: dónde se muestran", () => {
  it("la portada y cada categoría tienen su lugar, con los mismos nombres que usan las landings", () => {
    const claves = PAGINAS_DE_TESTIMONIOS.map((p) => p.clave);
    assert.ok(claves.includes("home"));
    for (const pagina of Object.values(PAGINA_TESTIMONIOS)) assert.ok(claves.includes(pagina as never), `falta ${pagina}`);
    assert.equal(etiquetaDePagina("educadores"), "Docentes");
    assert.equal(etiquetaDePagina("otra"), "otra", "una página desconocida se muestra como viene");
  });
});

describe("testimonios: validación", () => {
  it("acepta uno completo y limpia los espacios de más", () => {
    const r = testimonioSchema.parse({ ...valido, autor: "  Marina   Costa ", cargo: "Vicedirectora  ·  Colegio X" });
    assert.equal(r.autor, "Marina Costa");
    assert.equal(r.cargo, "Vicedirectora · Colegio X");
    assert.equal(r.fotoUrl, null);
  });

  it("saca las comillas pegadas alrededor de la cita (la página ya la pone entre comillas)", () => {
    assert.equal(limpiarCita("“Cubrimos una licencia en dos días.”"), "Cubrimos una licencia en dos días.");
    assert.equal(limpiarCita('"Nos sirvió mucho" '), "Nos sirvió mucho");
    assert.equal(limpiarCita("«Muy buena experiencia»"), "Muy buena experiencia");
    assert.equal(limpiarCita('Dijo "sí" y listo'), 'Dijo "sí" y listo', "las del medio se respetan");
  });

  it("pide la frase, el nombre y el cargo, con su mensaje", () => {
    const r = testimonioSchema.safeParse({ pagina: "home", cita: "corta", autor: "", cargo: "" });
    assert.equal(r.success, false);
    const campos = new Set(r.error!.issues.map((i) => String(i.path[0])));
    assert.deepEqual([...campos].sort(), ["autor", "cargo", "cita"]);
  });

  it("la cita tiene un largo máximo para que entre en el carrusel", () => {
    assert.equal(testimonioSchema.safeParse({ ...valido, cita: "a".repeat(LARGO_DE_CITA.max) }).success, true);
    assert.equal(testimonioSchema.safeParse({ ...valido, cita: "a".repeat(LARGO_DE_CITA.max + 1) }).success, false);
    assert.equal(testimonioSchema.safeParse({ ...valido, cita: "a".repeat(LARGO_DE_CITA.min - 1) }).success, false);
  });

  it("una página que no existe no se acepta", () => {
    assert.equal(testimonioSchema.safeParse({ ...valido, pagina: "contacto" }).success, false);
    assert.equal(testimonioSchema.safeParse({ ...valido, pagina: "constructor" }).success, false);
  });

  it("la foto es opcional y vacía es sin foto", () => {
    assert.equal(testimonioSchema.parse({ ...valido, fotoUrl: "" }).fotoUrl, null);
    assert.equal(testimonioSchema.parse({ ...valido, fotoUrl: undefined }).fotoUrl, null);
    assert.equal(testimonioSchema.parse({ ...valido, fotoUrl: null }).fotoUrl, null);
    assert.equal(testimonioSchema.parse({ ...valido, fotoUrl: " https://x.test/a.webp " }).fotoUrl, "https://x.test/a.webp");
  });
});

describe("testimonios: orden y cupo", () => {
  it("uno nuevo va después del último de su página", () => {
    assert.equal(siguienteOrden([]), 0);
    assert.equal(siguienteOrden([0, 1, 2]), 3);
    assert.equal(siguienteOrden([5, 2]), 6);
  });

  it("hay un tope por página, y los ocultos también ocupan lugar", () => {
    assert.equal(hayLugarEnPagina(MAX_TESTIMONIOS_POR_PAGINA - 1), true);
    assert.equal(hayLugarEnPagina(MAX_TESTIMONIOS_POR_PAGINA), false);
  });
});

describe("testimonios: foto", () => {
  const propia = (url: string) => url.startsWith("https://storage.test/mia/");
  it("sin foto, la misma que ya tenía o una que subió quien guarda", () => {
    assert.equal(fotoAceptada(null, "https://storage.test/otra/a.webp", propia), true);
    assert.equal(fotoAceptada("https://storage.test/otra/a.webp", "https://storage.test/otra/a.webp", propia), true);
    assert.equal(fotoAceptada("/assets/persona-f5.jpg", "/assets/persona-f5.jpg", propia), true, "las de ejemplo del sitio, sin cambiarlas");
    assert.equal(fotoAceptada("https://storage.test/mia/a.webp", null, propia), true);
  });

  it("no acepta una dirección ajena que no estaba ya guardada", () => {
    assert.equal(fotoAceptada("https://sitio-ajeno.test/foto.jpg", null, propia), false);
    assert.equal(fotoAceptada("https://storage.test/otra/a.webp", null, propia), false);
    assert.equal(fotoAceptada("/assets/persona-f5.jpg", null, propia), false);
  });
});
