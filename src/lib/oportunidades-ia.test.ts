import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretarBusqueda } from "@/lib/busqueda-ia";
import { leerFraseDeTrabajo } from "@/lib/oportunidades-ia";

const DISCIPLINAS = ["Inglés", "Matemática", "Educación Física", "Natación", "Música", "Lengua", "Fútbol"];

const leer = (frase: string, publico = false) => leerFraseDeTrabajo(frase, DISCIPLINAS, { publico });

describe("la frase de un profesional que busca trabajo", () => {
  it("materia, nivel y turno se convierten en filtros de las ofertas", () => {
    const r = leer("busco algo de inglés para primaria, de mañana");
    assert.deepEqual(r.filtros, { q: "Inglés", nivel: "Primario", turno: "Mañana" });
    assert.deepEqual(r.leido, ["Inglés", "Primario", "Turno mañana"]);
    assert.deepEqual(r.sinEntender, []);
  });

  it("los turnos de una oferta incluyen la noche y el fin de semana", () => {
    assert.equal(leer("profe de música, de noche").filtros.turno, "Noche");
    assert.equal(leer("profe de música los fines de semana").filtros.turno, "Fin de semana");
    assert.equal(leer("profe de música, contraturno").filtros.turno, "Contraturno");
  });

  it("mañana y tarde juntos son el turno 'Mañana y tarde'", () => {
    const r = leer("profe de lengua a la mañana y a la tarde");
    assert.equal(r.filtros.turno, "Mañana y tarde");
    assert.ok(r.leido.includes("Mañana y tarde"));
    assert.deepEqual(r.sinEntender, []);
  });

  it("con dos turnos que no se combinan se aplica uno y se avisa del otro", () => {
    const r = leer("profe de lengua de mañana y de noche");
    assert.equal(r.filtros.turno, "Mañana");
    assert.deepEqual(r.sinEntender, ["noche"]);
  });

  it("'suplencia' filtra por tipo y 'urgente' por búsqueda rápida", () => {
    assert.equal(leer("suplencia de natación").filtros.tipo, "Suplencia");
    assert.equal(leer("suplencia urgente de natación").filtros.rapidas, "1");
    assert.equal(leer("algo de planta para lengua").filtros.tipo, "Titular");
  });

  it("la categoría y 'solo verificadas' se aplican", () => {
    const r = leer("guardavidas en instituciones verificadas");
    assert.equal(r.filtros.categoria, "guardavidas");
    assert.equal(r.filtros.verificadas, "1");
    assert.ok(r.leido.includes("Instituciones verificadas"));
  });

  it("con dos materias se busca la primera y se avisa de la otra", () => {
    const r = leer("profe de inglés y música");
    assert.equal(r.filtros.q, "Inglés", "la primera que nombró");
    assert.deepEqual(r.sinEntender, ["Música"]);
  });

  it("una zona no es un filtro de esta pantalla: se busca como texto junto con la materia", () => {
    const r = leer("profe de inglés en olivos");
    assert.equal(r.filtros.q, "Inglés olivos");
    assert.equal(r.texto, "olivos");
    assert.equal(r.qSinTexto, "Inglés", "si con el texto no hay nada, se muestra lo de la materia sola");
    assert.deepEqual(r.sinEntender, []);
  });

  it("favoritos solo existe con cuenta", () => {
    assert.equal(leer("mis favoritos de música").filtros.favoritos, "1");
    const publica = leer("mis favoritos de música", true);
    assert.equal(publica.filtros.favoritos, undefined);
    assert.deepEqual(publica.sinEntender, ["favoritos"]);
  });

  it("una frase sin nada reconocible no filtra y lo dice", () => {
    const r = leer("quiero trabajar");
    assert.equal(r.reconocido, false);
    assert.deepEqual(r.filtros, {});
  });
});

describe("el buscador único del profesional: lo que no pide filtros se busca como texto", () => {
  it("una institución suelta se busca por su nombre, sin el relleno", () => {
    const r = leer("colegio San Andrés");
    assert.equal(r.texto, "San Andrés");
    assert.deepEqual(r.filtros, { q: "San Andrés" });
    assert.equal(r.reconocido, false);
  });

  it("una materia que el catálogo tiene sigue siendo la materia y no suma texto", () => {
    const r = leer("inglés");
    assert.deepEqual(r.filtros, { q: "Inglés" });
    assert.equal(r.texto, "");
    assert.deepEqual(r.leido, ["Inglés"]);
  });

  it("si la frase pide filtros, lo que sobra se busca además: la materia y la institución", () => {
    const r = leer("inglés San Andrés");
    assert.equal(r.texto, "San Andrés");
    assert.deepEqual(r.filtros, { q: "Inglés San Andrés" });
    assert.equal(r.qSinTexto, "Inglés");
    assert.deepEqual(r.leido, ["Inglés"]);
    assert.deepEqual(r.sinEntender, []);
  });

  it("el nombre se busca aunque se escriba en minúsculas y sin tildes", () => {
    const r = leer("ingles perez");
    assert.deepEqual(r.filtros, { q: "Inglés perez" });
  });

  it("junto con otros filtros, el texto no pisa nada", () => {
    const r = leer("inglés Pérez para primaria, de mañana");
    assert.deepEqual(r.filtros, { q: "Inglés Pérez", nivel: "Primario", turno: "Mañana" });
    assert.equal(r.qSinTexto, "Inglés");
  });

  it("sin materia, el texto solo es el q y no hay nada que relajar", () => {
    const r = leer("colegio San Andrés");
    assert.equal(r.filtros.q, "San Andrés");
    assert.equal(r.qSinTexto, undefined);
  });

  it("el q combinado nunca pasa de 80 caracteres (el largo máximo de la URL)", () => {
    const r = leer("inglés Alfabeto Bibliografia Circunferencia Dimension Equivalencia Fotosintesis Geografia");
    assert.ok((r.filtros.q ?? "").length <= 80);
  });

  it("sin palabras propias no hay texto", () => {
    const r = leer("quiero trabajar");
    assert.equal(r.texto, "");
    assert.equal(r.filtros.q, undefined);
  });
});

describe("el modo 'busca trabajo' del reconocedor", () => {
  it("devuelve los turnos con el nombre de una oferta y no cambia el modo de la institución", () => {
    assert.deepEqual(interpretarBusqueda("profe de noche", {}, { buscaTrabajo: true }).filtros.disponibilidad, ["Noche"]);
    // Para la institución "noche" no es un turno de los profesionales: queda sin entender.
    const institucion = interpretarBusqueda("profe de música de noche", { disciplinas: ["Música"] });
    assert.equal(institucion.filtros.disponibilidad, undefined);
    assert.deepEqual(institucion.sinEntender, ["noche"]);
  });
});
