import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOGO_ASIGNATURAS } from "@/db/seed-data";
import { claveDeRubro, habilitacionParaBusqueda, type RubrosDelCatalogo } from "@/lib/habilitacion";

/** El catálogo de ejemplo con su rubro, armado igual que lo hace `rubrosDelCatalogo` con la tabla. */
const RUBROS: RubrosDelCatalogo = new Map(
  Object.entries(CATALOGO_ASIGNATURAS).flatMap(([categoria, rubros]) =>
    rubros.flatMap((r) => r.items.map((nombre) => [claveDeRubro(categoria as "educador", nombre), r.rubro] as const)),
  ),
);

const docente = (asignaturas: string[]) => ({ categoria: "educador" as const, asignaturas });
const busqueda = (disciplina: string, categoria: "educador" | "entrenador" | "guardavidas" = "educador") => ({ categoria, disciplina });

describe("a qué búsquedas puede postularse un profesional", () => {
  it("el caso del cliente: quien da Literatura no puede postularse a Educación Física", () => {
    const r = habilitacionParaBusqueda(docente(["Literatura"]), busqueda("Educación Física"), RUBROS);
    assert.equal(r.habilitado, false);
    if (!r.habilitado) {
      assert.equal(r.motivo, "materia");
      assert.match(r.mensaje, /Educación Física/);
      assert.match(r.mensaje, /Literatura/);
      assert.match(r.mensaje, /Mi perfil/);
    }
  });

  it("puede postularse a una materia que dicta, sin importar tildes ni mayúsculas", () => {
    assert.equal(habilitacionParaBusqueda(docente(["Educación Física"]), busqueda("educacion fisica"), RUBROS).habilitado, true);
    assert.equal(habilitacionParaBusqueda(docente(["Matemática", "Física"]), busqueda("Física"), RUBROS).habilitado, true);
  });

  it("«Lengua» encuentra «Lengua y Literatura»: las mismas equivalencias de «Tu materia»", () => {
    assert.equal(habilitacionParaBusqueda(docente(["Lengua"]), busqueda("Lengua y Literatura"), RUBROS).habilitado, true);
  });

  it("puede postularse a otra materia de su misma área del catálogo (Lengua → Historia, las dos de «Lengua y sociales»)", () => {
    assert.equal(habilitacionParaBusqueda(docente(["Lengua"]), busqueda("Historia"), RUBROS).habilitado, true);
    // …pero no a otra área.
    assert.equal(habilitacionParaBusqueda(docente(["Lengua"]), busqueda("Matemática"), RUBROS).habilitado, false);
    assert.equal(habilitacionParaBusqueda(docente(["Lengua"]), busqueda("Inglés"), RUBROS).habilitado, false);
  });

  it("una búsqueda de otra categoría no se puede, aunque la materia se llame igual (Natación existe en tres categorías)", () => {
    const r = habilitacionParaBusqueda(docente(["Natación"]), busqueda("Natación", "guardavidas"), RUBROS);
    assert.equal(r.habilitado, false);
    if (!r.habilitado) {
      assert.equal(r.motivo, "categoria");
      assert.match(r.mensaje, /guardavidas/);
      assert.match(r.mensaje, /docentes/);
    }
  });

  it("el área se compara dentro de la categoría: un entrenador de Fútbol puede con Vóley (deportes de equipo) y no con Yoga", () => {
    const entrenador = { categoria: "entrenador" as const, asignaturas: ["Fútbol"] };
    assert.equal(habilitacionParaBusqueda(entrenador, busqueda("Vóley", "entrenador"), RUBROS).habilitado, true);
    assert.equal(habilitacionParaBusqueda(entrenador, busqueda("Yoga", "entrenador"), RUBROS).habilitado, false);
  });

  it("una materia fuera del catálogo (escrita a mano) solo coincide con la misma materia", () => {
    assert.equal(habilitacionParaBusqueda(docente(["Ajedrez"]), busqueda("Ajedrez"), RUBROS).habilitado, true);
    assert.equal(habilitacionParaBusqueda(docente(["Lengua"]), busqueda("Ajedrez"), RUBROS).habilitado, false);
  });

  it("sin asignaturas cargadas no hay con qué comparar: no se frena a nadie por eso", () => {
    assert.equal(habilitacionParaBusqueda(docente([]), busqueda("Educación Física"), RUBROS).habilitado, true);
    assert.equal(habilitacionParaBusqueda(docente(["", "  "]), busqueda("Educación Física"), RUBROS).habilitado, true);
  });

  it("pero la categoría siempre cuenta, también sin asignaturas", () => {
    assert.equal(habilitacionParaBusqueda(docente([]), busqueda("Vóley", "entrenador"), RUBROS).habilitado, false);
  });

  it("el mensaje lista las asignaturas de la persona sin repetirlas", () => {
    const r = habilitacionParaBusqueda(docente(["Lengua", "Literatura", "Lengua"]), busqueda("Educación Física"), RUBROS);
    assert.equal(r.habilitado, false);
    if (!r.habilitado) assert.match(r.mensaje, /Lengua y Literatura|Lengua, Literatura/);
  });

  describe("un perfil con más de una categoría", () => {
    const doble = (asignaturas: string[]) => ({ categoria: "educador" as const, categoriasExtra: ["guardavidas" as const], asignaturas });

    it("puede postularse a las búsquedas de cualquiera de sus categorías", () => {
      assert.equal(habilitacionParaBusqueda(doble([]), busqueda("Educación Física", "educador"), RUBROS).habilitado, true);
      assert.equal(habilitacionParaBusqueda(doble([]), busqueda("Natación", "guardavidas"), RUBROS).habilitado, true);
    });

    it("no a las de una categoría que no tiene, y el mensaje las nombra todas", () => {
      const r = habilitacionParaBusqueda(doble([]), busqueda("Vóley", "entrenador"), RUBROS);
      assert.equal(r.habilitado, false);
      if (!r.habilitado) {
        assert.equal(r.motivo, "categoria");
        assert.match(r.mensaje, /entrenadores/);
        assert.match(r.mensaje, /docentes y guardavidas/);
        assert.match(r.mensaje, /categorías/);
      }
    });

    it("la materia sigue contando: con Natación cargada puede con una búsqueda de guardavidas de Natación, no con otra materia sin relación", () => {
      assert.equal(habilitacionParaBusqueda(doble(["Natación"]), busqueda("Natación", "guardavidas"), RUBROS).habilitado, true);
      assert.equal(habilitacionParaBusqueda(doble(["Lengua"]), busqueda("Natación", "guardavidas"), RUBROS).habilitado, false);
    });
  });
});
