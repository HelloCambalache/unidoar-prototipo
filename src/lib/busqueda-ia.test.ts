import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  distanciaDeEdicion,
  interpretarBusqueda,
  MAX_PALABRAS_DE_TEXTO,
  textoDeLaFrase,
  type VocabularioBusqueda,
} from "@/lib/busqueda-ia";

/** Una parte del catálogo real: lo que la base le pasa al buscador. */
const VOCABULARIO: VocabularioBusqueda = {
  disciplinas: [
    "Música", "Plástica", "Teatro", "Danza", "Educación Física", "Natación", "Biología", "Informática", "Matemática",
    "Lengua", "Literatura", "Ciencias Naturales", "Inglés", "Portugués", "Psicopedagogía", "Apoyo escolar", "Fútbol",
    "Tenis", "Artes marciales", "Preparación física", "Colonia de vacaciones", "Primeros auxilios",
  ],
  zonas: ["Belgrano", "Palermo", "CABA", "Olivos", "Florida", "Martínez", "San Isidro", "Tigre", "Vicente López"],
};

const leer = (frase: string) => interpretarBusqueda(frase, VOCABULARIO);

describe("lo que ya entendía", () => {
  it("disciplina, nivel y turno en una frase", () => {
    const r = leer("profe de inglés para secundario, turno mañana");
    assert.deepEqual(r.leido, ["Inglés", "Secundario", "Turno mañana"]);
    assert.deepEqual(r.filtros, { disciplinas: ["Inglés"], nivel: "Secundario", disponibilidad: ["Turno mañana"] });
    assert.deepEqual(r.sinEntender, []);
  });

  it("una frase urgente va a búsquedas rápidas, y 'mañana mismo' no es el turno mañana", () => {
    const r = leer("necesito un guardavidas para mañana mismo");
    assert.equal(r.filtros.rapidas, true);
    assert.equal(r.filtros.categoria, "guardavidas");
    assert.equal(r.filtros.disponibilidad, undefined);
  });

  it("'educación física' no suma también 'física'", () => {
    assert.deepEqual(leer("profesor de educación física").filtros.disciplinas, ["Educación Física"]);
  });

  it("sin nada reconocible no inventa filtros", () => {
    const r = leer("hola");
    assert.equal(r.reconocido, false);
    assert.deepEqual(r.filtros, {});
    assert.deepEqual(leer("").sinEntender, []);
  });
});

describe("sinónimos", () => {
  it("gimnasia, castellano, pileta y baile se entienden como la disciplina del catálogo", () => {
    assert.deepEqual(leer("profe de gimnasia").filtros.disciplinas, ["Educación Física"]);
    assert.deepEqual(leer("docente de castellano").filtros.disciplinas, ["Lengua"]);
    assert.deepEqual(leer("alguien para la pileta").filtros.disciplinas, ["Natación"]);
    assert.deepEqual(leer("instructora de baile").filtros.disciplinas, ["Danza"]);
    assert.deepEqual(leer("profesor de karate").filtros.disciplinas, ["Artes marciales"]);
  });

  it("un sinónimo de una disciplina que el catálogo no tiene no filtra por nada", () => {
    assert.equal(interpretarBusqueda("profe de karate", { disciplinas: ["Inglés"] }).filtros.disciplinas, undefined);
  });

  it("suplente, reemplazo y licencia son una suplencia; 'de planta', un titular", () => {
    assert.equal(leer("suplente de biología").filtros.tipo, "Suplencia");
    assert.equal(leer("un reemplazo por licencia").filtros.tipo, "Suplencia");
    assert.equal(leer("alguien de planta para lengua").filtros.tipo, "Titular");
  });
});

describe("niveles escritos de varias formas", () => {
  it("primer grado, 1° grado y 'grado' son primario", () => {
    for (const frase of ["profe para primer grado", "profe para 1° grado", "maestra de grado", "profe para 3er grado"]) {
      assert.equal(leer(frase).filtros.nivel, "Primario", frase);
    }
  });

  it("sala de 4, preescolar y maternal son inicial; polimodal, secundario", () => {
    assert.equal(leer("maestra para sala de 4").filtros.nivel, "Inicial");
    assert.equal(leer("preescolar").filtros.nivel, "Inicial");
    assert.equal(leer("polimodal").filtros.nivel, "Secundario");
    assert.equal(leer("profe universitario").filtros.nivel, "Terciario");
  });
});

describe("errores de tipeo", () => {
  it("una disciplina mal escrita se reconoce", () => {
    assert.deepEqual(leer("profe de matematca").filtros.disciplinas, ["Matemática"]);
    assert.deepEqual(leer("profesora de ingeles").filtros.disciplinas, ["Inglés"]);
    assert.deepEqual(leer("clases de natacion").filtros.disciplinas, ["Natación"]);
  });

  it("una zona mal escrita se reconoce", () => {
    assert.deepEqual(leer("profe en martines").filtros.zonas, ["Martínez"]);
    assert.deepEqual(leer("entrenador en tigree").filtros.zonas, ["Tigre"]);
  });

  it("no confunde palabras de todos los días con una disciplina", () => {
    for (const frase of ["tenés alguien de planta?", "tenia que ser de olivos", "queres sumar a alguien"]) {
      assert.equal(leer(frase).filtros.disciplinas, undefined, frase);
    }
    assert.deepEqual(leer("tenés alguien de tenis").filtros.disciplinas, ["Tenis"]);
  });

  it("las palabras cortas no se corrigen: se confundirían con otras", () => {
    assert.equal(leer("profe de yogi").filtros.disciplinas, undefined);
  });
});

describe("zonas", () => {
  it("capital es CABA y zona norte junta varios partidos", () => {
    assert.deepEqual(leer("profe en capital").filtros.zonas, ["CABA"]);
    assert.deepEqual(leer("profe en zona norte").filtros.zonas, ["Vicente López", "San Isidro", "Tigre"]);
    assert.deepEqual(leer("profe en zona norte").leido, ["Zona norte"]);
  });

  it("si el catálogo no tiene esas zonas, no las inventa", () => {
    const r = interpretarBusqueda("profe en zona norte", { zonas: ["Belgrano"] });
    assert.equal(r.filtros.zonas, undefined);
    assert.deepEqual(r.sinEntender, ["norte"]);
  });

  it("varias zonas sueltas", () => {
    assert.deepEqual(leer("profe de olivos o florida").filtros.zonas?.toSorted(), ["Florida", "Olivos"]);
  });
});

describe("lo que no se pudo aplicar", () => {
  it("avisa las palabras que quedaron sin convertirse en un filtro", () => {
    const r = leer("profe de informática, adultos, de noche");
    assert.deepEqual(r.filtros.disciplinas, ["Informática"]);
    assert.deepEqual(r.sinEntender, ["noche"]);
  });

  it("no cuenta como 'sin entender' el relleno ni lo que sí se aplicó", () => {
    const r = leer("necesito una profesora de inglés para secundario, por favor, que sea puntual");
    assert.deepEqual(r.leido, ["Inglés", "Secundario"]);
    assert.deepEqual(r.sinEntender, ["puntual"]);
  });

  it("mantiene cómo lo escribió la persona y no repite", () => {
    const r = leer("Profe de Música, Noche, noche");
    assert.deepEqual(r.sinEntender, ["Noche"]);
  });
});

describe("el buscador único: lo que no pide filtros se busca como texto", () => {
  it("un nombre suelto no pide ningún filtro: se busca tal cual lo escribió", () => {
    const r = leer("Ana Pérez");
    assert.equal(r.reconocido, false);
    assert.deepEqual(r.resto, ["Ana", "Pérez"]);
    assert.equal(textoDeLaFrase(r), "Ana Pérez");
  });

  it("el relleno de una frase no se busca ('busco a Ana Pérez')", () => {
    assert.equal(textoDeLaFrase(leer("busco a Ana Pérez")), "Ana Pérez");
    assert.equal(textoDeLaFrase(leer("necesito a Ana Pérez, por favor")), "Ana Pérez");
  });

  it("una disciplina que el catálogo no tiene también se busca como texto", () => {
    assert.equal(textoDeLaFrase(leer("ajedrez")), "ajedrez");
  });

  it("los nombres cortos cuentan (las palabras de dos letras no)", () => {
    assert.deepEqual(leer("Eva").resto, ["Eva"]);
    assert.deepEqual(leer("Li").resto, []);
  });

  it("sin palabras propias no hay texto que buscar", () => {
    assert.equal(textoDeLaFrase(leer("hola")), "");
    assert.equal(textoDeLaFrase(leer("necesito un profe, por favor")), "");
    assert.equal(textoDeLaFrase(leer("")), "");
  });

  it("si la frase pide algún filtro, es un pedido: lo que sobra se avisa y no se busca", () => {
    const r = leer("inglés Pérez");
    assert.equal(r.reconocido, true);
    assert.deepEqual(r.resto, ["Pérez"]);
    assert.deepEqual(r.sinEntender, ["Pérez"]);
    assert.equal(textoDeLaFrase(r), "");
  });

  it("una frase completa de las de antes sigue siendo solo filtros", () => {
    assert.equal(textoDeLaFrase(leer("profe de inglés para secundario, turno mañana")), "");
    assert.equal(textoDeLaFrase(leer("necesito un guardavidas para mañana mismo")), "");
  });

  it("busca hasta seis palabras y mantiene cómo las escribió", () => {
    const r = leer("Nuestra Señora del Carmen de las Flores Azules Grandes Lejanas Remotas");
    assert.equal(textoDeLaFrase(r), "Señora Carmen Flores Azules Grandes Lejanas");
    assert.equal(textoDeLaFrase(r).split(" ").length, MAX_PALABRAS_DE_TEXTO);
  });

  it("no repite una palabra", () => {
    assert.deepEqual(leer("Pérez pérez PEREZ").resto, ["Pérez"]);
  });
});

describe("distancia de edición", () => {
  it("cuenta letras de diferencia y corta al pasar el tope", () => {
    assert.equal(distanciaDeEdicion("matematica", "matematica", 2), 0);
    assert.equal(distanciaDeEdicion("matematca", "matematica", 2), 1);
    assert.equal(distanciaDeEdicion("ingeles", "ingles", 2), 1);
    assert.equal(distanciaDeEdicion("casa", "perro", 1), 2, "supera el tope: devuelve tope + 1");
  });
});
