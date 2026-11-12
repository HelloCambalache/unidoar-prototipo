import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cantidadDePropias,
  conservarAlCambiarDeCategoria,
  errorDeAsignaturaEscrita,
  limpiarAsignatura,
  MAX_ASIGNATURAS_PROPIAS,
  MAX_LARGO_ASIGNATURA,
  sumarAsignatura,
  validarAsignaturas,
} from "./asignaturas";

const CATALOGO = ["Natación", "Fútbol", "Preparación física", "Danza deportiva"];

describe("limpiarAsignatura", () => {
  it("saca los espacios de más y respeta el tope de largo", () => {
    assert.equal(limpiarAsignatura("  Pilates   mat  "), "Pilates mat");
    assert.equal(limpiarAsignatura("a".repeat(200)).length, MAX_LARGO_ASIGNATURA);
  });
});

describe("errorDeAsignaturaEscrita", () => {
  it("acepta nombres de disciplinas con tildes y puntuación", () => {
    for (const ok of ["Pilates", "Yoga (niños)", "Pre-deportivo", "Ed. Física", "Crossfit 2.0", "Judo & Karate"]) {
      assert.equal(errorDeAsignaturaEscrita(ok), null, ok);
    }
  });

  it("pide escribir algo", () => {
    assert.match(errorDeAsignaturaEscrita("") ?? "", /Escribí/);
    assert.match(errorDeAsignaturaEscrita("  a ") ?? "", /Escribí/);
  });

  it("rechaza lo que no es un nombre (marcas, símbolos)", () => {
    for (const mal of ["<script>alert(1)</script>", "Yoga; drop table", "Pilates 🙂", "a=b"]) {
      assert.match(errorDeAsignaturaEscrita(mal) ?? "", /letras y números/, mal);
    }
  });
});

describe("sumarAsignatura", () => {
  it("suma una escrita a mano con su texto limpio", () => {
    const r = sumarAsignatura([], "  pilates ", CATALOGO);
    assert.deepEqual(r, { ok: true, asignaturas: ["pilates"] });
  });

  it("si lo escrito es del catálogo usa su forma canónica (sin mirar tildes ni mayúsculas) y no cuenta como propia", () => {
    const r = sumarAsignatura(["Pilates", "Yoga", "Crossfit"], "natacion", CATALOGO);
    assert.deepEqual(r, { ok: true, asignaturas: ["Pilates", "Yoga", "Crossfit", "Natación"] });
  });

  it("avisa si ya estaba, escrita de otra forma", () => {
    assert.deepEqual(sumarAsignatura(["Pilates"], " PILATES", CATALOGO), { ok: false, error: "Ya la sumaste." });
    assert.deepEqual(sumarAsignatura(["Natación"], "natacion", CATALOGO), { ok: false, error: "Ya la sumaste." });
  });

  it("tiene un tope de las que no están en la lista", () => {
    const tres = ["Pilates", "Yoga", "Crossfit"];
    assert.equal(tres.length, MAX_ASIGNATURAS_PROPIAS);
    const r = sumarAsignatura(["Natación", ...tres], "Zumba", CATALOGO);
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.error, /hasta 3/);
  });

  it("no suma algo inválido", () => {
    assert.equal(sumarAsignatura([], "<b>", CATALOGO).ok, false);
  });
});

describe("cantidadDePropias", () => {
  it("cuenta solo las que no están en el catálogo", () => {
    assert.equal(cantidadDePropias(["Natación", "Pilates", "fútbol", "Yoga"], CATALOGO), 2);
  });
});

describe("validarAsignaturas (lo que guarda el servidor)", () => {
  it("deja las del catálogo con su escritura canónica y las escritas a mano, sin repetir", () => {
    const r = validarAsignaturas(["natacion", "Natación", "Pilates", "pilates ", "Fútbol"], CATALOGO);
    assert.deepEqual(r, { ok: true, asignaturas: ["Natación", "Pilates", "Fútbol"] });
  });

  it("rechaza pasarse del tope de escritas a mano", () => {
    const r = validarAsignaturas(["Pilates", "Yoga", "Crossfit", "Zumba"], CATALOGO);
    assert.equal(r.ok, false);
  });

  it("rechaza un nombre inválido", () => {
    assert.equal(validarAsignaturas(["Natación", "<img src=x>"], CATALOGO).ok, false);
  });

  it("una lista vacía es válida (el esquema pide al menos una antes de llegar acá)", () => {
    assert.deepEqual(validarAsignaturas([], CATALOGO), { ok: true, asignaturas: [] });
  });
});

describe("conservarAlCambiarDeCategoria", () => {
  const deLaNueva = ["Matemática", "Lengua"];
  const deTodas = [...deLaNueva, ...CATALOGO];

  it("descarta las del catálogo de otra categoría y conserva las de la nueva y las escritas a mano", () => {
    const r = conservarAlCambiarDeCategoria(["Natación", "Lengua", "Pilates"], deLaNueva, deTodas);
    assert.deepEqual(r, ["Lengua", "Pilates"]);
  });
});
