import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fechaLarga } from "@/lib/fechas-curso";
import { sugerirDescripcion, sugerirPuesto, sugerirRequisitos, VARIANTES, type DatosParaRedactar } from "@/lib/redaccion-busqueda";

const base: DatosParaRedactar = {
  categoria: "educador",
  disciplina: "Inglés",
  nivel: "Secundario",
  tipo: "Titular",
  cargaHoraria: "",
  turno: "",
  fechaInicio: "",
  zona: "",
};

const completo: DatosParaRedactar = {
  ...base,
  tipo: "Suplencia",
  cargaHoraria: "18 hs semanales",
  turno: "Mañana",
  fechaInicio: "2027-03-10",
  zona: " Villa  Adelina, Vicente López ",
};

const CIERRE = "Si te interesa, postulate desde UNIDOAR.";

describe("título del puesto", () => {
  it("arma el título según la categoría", () => {
    assert.equal(sugerirPuesto(base), "Profe de Inglés — Secundario");
    assert.equal(sugerirPuesto({ ...base, categoria: "entrenador", disciplina: "Natación", nivel: "" }), "Entrenador/a de Natación");
    assert.equal(sugerirPuesto({ ...base, categoria: "guardavidas", disciplina: "Pileta cubierta", nivel: "Secundario" }), "Guardavidas — Pileta cubierta");
  });

  it("indica el tipo cuando no es un cargo titular", () => {
    assert.equal(sugerirPuesto({ ...base, tipo: "Suplencia" }), "Profe de Inglés — Secundario (suplencia)");
    assert.equal(sugerirPuesto({ ...base, tipo: "Suplencia rápida", nivel: "" }), "Profe de Inglés (suplencia urgente)");
    assert.equal(sugerirPuesto({ ...base, tipo: "Temporada" }), "Profe de Inglés — Secundario (temporada)");
  });

  it("no dice 'Profe de' de un puesto que ya lo es", () => {
    assert.equal(sugerirPuesto({ ...base, disciplina: "Apoyo escolar", nivel: "Primario" }), "Apoyo escolar — Primario");
    assert.equal(sugerirPuesto({ ...base, disciplina: "Maestro/a de grado", nivel: "" }), "Maestro/a de grado");
  });

  it("un club no lleva un nivel escolar", () => {
    assert.equal(sugerirPuesto({ ...base, categoria: "entrenador", disciplina: "Fútbol", nivel: "No formal (club)" }), "Entrenador/a de Fútbol");
  });

  it("sin disciplina no sugiere nada", () => {
    assert.equal(sugerirPuesto({ ...base, disciplina: "  " }), "");
    assert.equal(sugerirDescripcion({ ...base, disciplina: "" }), "");
    assert.equal(sugerirRequisitos({ ...base, disciplina: "" }), "");
  });

  it("tiene tres redacciones: directa, 'Se busca' y con el turno o la zona", () => {
    const d = { ...base, tipo: "Suplencia", turno: "Mañana" };
    assert.equal(sugerirPuesto(d, 0), "Profe de Inglés — Secundario (suplencia)");
    assert.equal(sugerirPuesto(d, 1), "Se busca profe de Inglés — Secundario (suplencia)");
    assert.equal(sugerirPuesto(d, 2), "Profe de Inglés — Secundario (suplencia) · turno mañana");
    assert.equal(sugerirPuesto({ ...d, turno: "Fin de semana" }, 2), "Profe de Inglés — Secundario (suplencia) · fines de semana");
  });

  it("la tercera usa la zona si no hay turno y, sin ninguno, cambia el verbo", () => {
    assert.equal(sugerirPuesto({ ...base, zona: "Villa Adelina, Vicente López" }, 2), "Profe de Inglés — Secundario · Villa Adelina");
    assert.equal(sugerirPuesto(base, 2), "Necesitamos profe de Inglés — Secundario");
  });

  it("da la vuelta y nunca pasa de 120 caracteres, el máximo del campo", () => {
    assert.equal(sugerirPuesto(base, VARIANTES.puesto), sugerirPuesto(base, 0));
    assert.equal(sugerirPuesto(base, -1), sugerirPuesto(base, VARIANTES.puesto - 1));
    for (let n = 0; n < VARIANTES.puesto; n++) assert.ok(sugerirPuesto({ ...completo, disciplina: "x".repeat(200) }, n).length <= 120);
  });

  it("una disciplina escrita a mano no se confunde con un puesto del catálogo", () => {
    assert.equal(sugerirPuesto({ ...base, disciplina: "constructor", nivel: "" }), "Profe de constructor");
    assert.equal(sugerirPuesto({ ...base, disciplina: "toString", nivel: "" }), "Profe de toString");
  });
});

describe("descripción", () => {
  it("la completa dice quién se busca, las condiciones y qué se va a hacer", () => {
    assert.equal(
      sugerirDescripcion(base),
      [
        "Buscamos profesor/a de Inglés para nivel secundario. Es un cargo titular.",
        "Qué vas a hacer:\n• Planificar y dictar las clases de Inglés.\n• Evaluar y acompañar el avance del grupo.\n• Trabajar en equipo con el resto del plantel.",
        CIERRE,
      ].join("\n\n"),
    );
  });

  it("la completa suma carga, turno, inicio y zona cuando están", () => {
    const texto = sugerirDescripcion(completo);
    assert.ok(
      texto.startsWith(
        `Buscamos profesor/a de Inglés para nivel secundario. Es una suplencia. La carga horaria es de 18 hs semanales. Se trabaja en turno mañana. La fecha de inicio es el ${fechaLarga("2027-03-10")}. Zona de trabajo: Villa Adelina, Vicente López.\n\nQué vas a hacer:`,
      ),
      texto,
    );
  });

  it("la breve es un solo párrafo con lo que se completó", () => {
    assert.equal(sugerirDescripcion(base, 1), `Buscamos profesor/a de Inglés para nivel secundario. Es un cargo titular. ${CIERRE}`);
    assert.equal(
      sugerirDescripcion(completo, 1),
      `Buscamos profesor/a de Inglés para nivel secundario. Es una suplencia. La carga horaria es de 18 hs semanales. Se trabaja en turno mañana. La fecha de inicio es el ${fechaLarga("2027-03-10")}. Zona de trabajo: Villa Adelina, Vicente López. ${CIERRE}`,
    );
  });

  it("la lista pone cada dato con su título y solo los que se cargaron", () => {
    assert.equal(
      sugerirDescripcion(completo, 2),
      [
        "Se busca profesor/a de Inglés para nivel secundario.",
        `• Tipo de cargo: Suplencia\n• Carga horaria: 18 hs semanales\n• Turno: Mañana\n• Inicio: ${fechaLarga("2027-03-10")}\n• Zona: Villa Adelina, Vicente López`,
        CIERRE,
      ].join("\n\n"),
    );
    assert.equal(sugerirDescripcion({ ...base, tipo: "" }, 2), `Se busca profesor/a de Inglés para nivel secundario.\n\n${CIERRE}`);
  });

  it("una fecha mal formada no se inventa, en ninguna redacción", () => {
    for (let n = 0; n < VARIANTES.descripcion; n++) {
      const texto = sugerirDescripcion({ ...base, fechaInicio: "mañana" }, n);
      assert.ok(!texto.includes("fecha de inicio") && !texto.includes("Inicio:"), `variante ${n}`);
    }
  });

  it("no promete nada que no se cargó: ni beneficios ni sueldo, en ninguna redacción ni categoría", () => {
    for (const categoria of ["educador", "entrenador", "guardavidas"] as const) {
      for (let n = 0; n < VARIANTES.descripcion; n++) {
        const texto = sugerirDescripcion({ ...base, categoria, cargaHoraria: "18 hs" }, n).toLowerCase();
        for (const palabra of ["sueldo", "beneficio", "salario", "$", "remuner"]) assert.ok(!texto.includes(palabra), `${categoria} ${n}: ${palabra}`);
      }
    }
  });

  it("las tres redacciones son distintas y dan la vuelta", () => {
    const textos = Array.from({ length: VARIANTES.descripcion }, (_, n) => sugerirDescripcion(completo, n));
    assert.equal(new Set(textos).size, VARIANTES.descripcion);
    assert.equal(sugerirDescripcion(completo, VARIANTES.descripcion), textos[0]);
  });

  it("guardavidas y entrenadores tienen su propia redacción", () => {
    const guardavidas = { ...base, categoria: "guardavidas" as const, disciplina: "Pileta cubierta", turno: "Fin de semana" };
    assert.ok(sugerirDescripcion(guardavidas, 1).startsWith("Buscamos guardavidas para pileta cubierta."));
    assert.ok(sugerirDescripcion(guardavidas).includes("• Vigilar el espacio acuático durante toda la actividad."));
    const entrenador = { ...base, categoria: "entrenador" as const, disciplina: "Fútbol", nivel: "" };
    assert.ok(sugerirDescripcion(entrenador, 1).startsWith("Buscamos entrenador/a de Fútbol."));
    assert.ok(sugerirDescripcion(entrenador).includes("• Planificar y dirigir las clases y entrenamientos de Fútbol."));
  });

  it("un puesto que ya dice el nivel no lo repite ni se vuelve 'de X'", () => {
    const inicial = { ...base, disciplina: "Nivel Inicial", nivel: "Inicial" };
    assert.equal(sugerirDescripcion(inicial, 1), `Buscamos docente de nivel inicial. Es un cargo titular. ${CIERRE}`);
    assert.ok(sugerirDescripcion(inicial).includes("• Planificar y dictar las clases.\n"));
    assert.ok(sugerirDescripcion({ ...base, disciplina: "Psicopedagogía", nivel: "" }, 1).startsWith("Buscamos psicopedagogo/a."));
  });

  it("nombra bien a adultos y a los clubes", () => {
    assert.ok(sugerirDescripcion({ ...base, nivel: "Adultos" }, 1).startsWith("Buscamos profesor/a de Inglés para adultos."));
    assert.ok(sugerirDescripcion({ ...base, categoria: "entrenador", disciplina: "Yoga", nivel: "No formal (club)" }, 1).startsWith("Buscamos entrenador/a de Yoga para actividades de club."));
  });
});

describe("requisitos", () => {
  it("los esenciales son los habituales de cada categoría, uno por línea", () => {
    assert.equal(sugerirRequisitos(base), "Título docente o en trámite\nExperiencia en nivel secundario");
    assert.equal(sugerirRequisitos({ ...base, categoria: "guardavidas", disciplina: "Playa" }), "Título de guardavidas vigente\nCurso de RCP y primeros auxilios al día");
    assert.equal(sugerirRequisitos({ ...base, categoria: "entrenador", disciplina: "Tenis" }), "Título o certificación en Tenis\nExperiencia dictando clases o entrenando grupos");
  });

  it("los ampliados suman buena conducta, disponibilidad y referencias", () => {
    assert.equal(
      sugerirRequisitos(base, 1),
      "Título docente o en trámite\nExperiencia en nivel secundario\nCertificado de buena conducta vigente\nReferencias de trabajos anteriores",
    );
    assert.equal(
      sugerirRequisitos({ ...base, turno: "Fin de semana" }, 1),
      "Título docente o en trámite\nExperiencia en nivel secundario\nCertificado de buena conducta vigente\nDisponibilidad horaria para fines de semana\nReferencias de trabajos anteriores",
    );
  });

  it("los ampliados de guardavidas y entrenadores tienen lo suyo", () => {
    assert.equal(
      sugerirRequisitos({ ...base, categoria: "guardavidas", disciplina: "Playa", turno: "Mañana" }, 1),
      "Título de guardavidas vigente\nCurso de RCP y primeros auxilios al día\nCertificado de buena conducta vigente\nApto médico al día\nDisponibilidad horaria para turno mañana\nReferencias de trabajos anteriores",
    );
    assert.ok(sugerirRequisitos({ ...base, categoria: "entrenador", disciplina: "Tenis" }, 1).includes("Conocimientos de primeros auxilios (deseable)"));
  });

  it("el turno no cambia los esenciales y las dos redacciones dan la vuelta", () => {
    assert.equal(sugerirRequisitos({ ...base, turno: "Noche" }), sugerirRequisitos(base));
    assert.equal(sugerirRequisitos(base, VARIANTES.requisitos), sugerirRequisitos(base, 0));
    assert.notEqual(sugerirRequisitos(base, 0), sugerirRequisitos(base, 1));
  });
});
