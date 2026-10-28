import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoriaDeBusqueda, compararOfertas, leerFiltrosOportunidades, urgentesPrimero } from "@/lib/oportunidades";

const o = (id: string, rapida: boolean, postulacion: unknown = null) => ({ id, rapida, postulacion });

describe("categoriaDeBusqueda", () => {
  it("sin elegir, un profesional ve la categoría de su perfil", () => {
    assert.equal(categoriaDeBusqueda(undefined, "educador"), "educador");
    assert.equal(categoriaDeBusqueda(undefined, "guardavidas"), "guardavidas");
  });

  it("lo que elige manda sobre su categoría", () => {
    assert.equal(categoriaDeBusqueda("entrenador", "educador"), "entrenador");
    assert.equal(categoriaDeBusqueda("educador", "educador"), "educador");
  });

  it("«todas» muestra las de cualquier categoría", () => {
    assert.equal(categoriaDeBusqueda("todas", "educador"), undefined);
    assert.equal(categoriaDeBusqueda("todas", undefined), undefined);
  });

  it("sin perfil (el sitio público) y sin elegir, no filtra nada", () => {
    assert.equal(categoriaDeBusqueda(undefined, undefined), undefined);
    assert.equal(categoriaDeBusqueda(undefined, null), undefined);
    assert.equal(categoriaDeBusqueda("guardavidas", undefined), "guardavidas");
  });
});

describe("leerFiltrosOportunidades: categoría", () => {
  it("acepta una categoría, «todas» y descarta cualquier otro valor", () => {
    assert.equal(leerFiltrosOportunidades({ categoria: "guardavidas" }).categoria, "guardavidas");
    assert.equal(leerFiltrosOportunidades({ categoria: "todas" }).categoria, "todas");
    assert.equal(leerFiltrosOportunidades({ categoria: "cualquiera" }).categoria, undefined);
    assert.equal(leerFiltrosOportunidades({}).categoria, undefined);
  });
});

describe("compararOfertas", () => {
  const of = (id: string, rapida: boolean, disciplina: string, km: number | null) => ({ id, rapida, disciplina, km });
  const orden = (lista: ReturnType<typeof of>[], asignaturas: string[]) =>
    [...lista].sort((a, b) => compararOfertas(a, b, asignaturas)).map((x) => x.id);

  it("las rápidas van primero, sea cual sea la materia", () => {
    const lista = [of("lengua", false, "Lengua", 1), of("urgente", true, "Matemática", 20)];
    assert.deepEqual(orden(lista, ["Lengua"]), ["urgente", "lengua"]);
  });

  it("a igual urgencia, primero las de su materia aunque estén más lejos", () => {
    const lista = [of("cerca", false, "Historia", 2), of("suya", false, "Lengua y Literatura", 15)];
    assert.deepEqual(orden(lista, ["Lengua"]), ["suya", "cerca"]);
  });

  it("entre iguales, la más cercana; sin distancia, al final", () => {
    const lista = [of("sin", false, "Historia", null), of("lejos", false, "Historia", 9), of("cerca", false, "Historia", 3)];
    assert.deepEqual(orden(lista, []), ["cerca", "lejos", "sin"]);
  });

  it("sin materias cargadas ordena solo por urgencia y distancia", () => {
    const lista = [of("b", false, "Lengua", 8), of("a", false, "Historia", 4)];
    assert.deepEqual(orden(lista, []), ["a", "b"]);
  });
});

describe("urgentesPrimero", () => {
  it("pone adelante las urgentes abiertas y deja el resto en el orden que traía", () => {
    const orden = urgentesPrimero([o("a", false), o("b", true), o("c", false), o("d", true)]).map((x) => x.id);
    assert.deepEqual(orden, ["b", "d", "a", "c"]);
  });

  it("una urgente a la que la persona ya se postuló no va primero", () => {
    const orden = urgentesPrimero([o("a", false), o("b", true, { texto: "Postulada" }), o("c", true)]).map((x) => x.id);
    assert.deepEqual(orden, ["c", "a", "b"]);
  });

  it("no toca la lista que recibe", () => {
    const original = [o("a", false), o("b", true)];
    urgentesPrimero(original);
    assert.deepEqual(original.map((x) => x.id), ["a", "b"]);
  });
});
