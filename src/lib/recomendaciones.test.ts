import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ordenarPorPuntaje,
  puntosPorCercania,
  puntosPorExperiencia,
  puntuarCandidato,
  type BusquedaAbierta,
  type CandidatoRecomendable,
} from "@/lib/recomendaciones";

const candidato: CandidatoRecomendable = {
  categoria: "educador",
  asignaturas: ["Inglés"],
  niveles: ["Secundario"],
  disponibilidad: ["Turno mañana"],
  aniosExperiencia: 8,
  tituloVerificado: true,
  km: 3,
};

const busqueda: BusquedaAbierta = { categoria: "educador", disciplina: "Inglés", nivel: "Secundario", turno: "Mañana" };

describe("puntos por cercanía y experiencia", () => {
  it("la cercanía baja con la distancia y no pasa de 20", () => {
    assert.equal(puntosPorCercania(0), 20);
    assert.equal(puntosPorCercania(2), 20);
    assert.ok(puntosPorCercania(5) < puntosPorCercania(3));
    assert.equal(puntosPorCercania(40), 0);
    assert.equal(puntosPorCercania(null), 0);
  });

  it("la experiencia suma un punto por año hasta 10", () => {
    assert.equal(puntosPorExperiencia(4), 4);
    assert.equal(puntosPorExperiencia(30), 10);
    assert.equal(puntosPorExperiencia(null), 0);
  });
});

describe("puntuar a un candidato", () => {
  it("da más a quien coincide con la búsqueda en disciplina, nivel y turno", () => {
    const r = puntuarCandidato(candidato, [busqueda]);
    assert.deepEqual(r.motivos.slice(0, 3), ["Da Inglés, como tu búsqueda abierta", "Trabaja en nivel secundario", "Disponible en turno mañana"]);
    assert.ok(r.motivos.includes("A 3 km de tu sede"));
    assert.ok(r.motivos.includes("8 años de experiencia"));
    assert.ok(r.motivos.includes("Título verificado"));
    // 40 + 8 + 8 (búsqueda) + 19 (3 km) + 8 (años) + 5 (título)
    assert.equal(r.puntaje, 88);
  });

  it("la disciplina pesa más que el nivel y el turno juntos", () => {
    const soloDisciplina = puntuarCandidato({ ...candidato, niveles: [], disponibilidad: [], km: null, aniosExperiencia: null, tituloVerificado: false }, [busqueda]);
    const soloNivelYTurno = puntuarCandidato({ ...candidato, asignaturas: ["Música"], km: null, aniosExperiencia: null, tituloVerificado: false }, [busqueda]);
    assert.ok(soloDisciplina.puntaje > soloNivelYTurno.puntaje);
  });

  it("no cuenta una búsqueda de otra categoría", () => {
    const r = puntuarCandidato(candidato, [{ ...busqueda, categoria: "guardavidas" }]);
    assert.ok(!r.motivos.some((m) => m.startsWith("Da ")));
  });

  it("toma la búsqueda con la que más coincide, entre varias", () => {
    const musica: BusquedaAbierta = { categoria: "educador", disciplina: "Música", nivel: null, turno: null };
    const r = puntuarCandidato(candidato, [musica, busqueda]);
    assert.equal(r.motivos[0], "Da Inglés, como tu búsqueda abierta");
  });

  it("sin búsquedas abiertas cuentan solo cercanía, experiencia y título", () => {
    const r = puntuarCandidato(candidato, []);
    assert.deepEqual(r.motivos, ["A 3 km de tu sede", "8 años de experiencia", "Título verificado"]);
  });

  it("no inventa motivos que no tiene", () => {
    const r = puntuarCandidato({ ...candidato, km: 25, aniosExperiencia: 1, tituloVerificado: false }, []);
    assert.deepEqual(r.motivos, []);
  });
});

describe("ordenar", () => {
  it("de más a menos puntaje y, ante un empate, el más cercano primero", () => {
    const ordenados = ordenarPorPuntaje([
      { id: "a", puntaje: 50, km: 9 },
      { id: "b", puntaje: 70, km: 20 },
      { id: "c", puntaje: 50, km: 2 },
      { id: "d", puntaje: 50, km: null },
    ]);
    assert.deepEqual(ordenados.map((x) => x.id), ["b", "c", "a", "d"]);
  });
});
