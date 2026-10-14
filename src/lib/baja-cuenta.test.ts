import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  comparable,
  confirmaElEmail,
  confirmaElTexto,
  cuentasDelEquipoParaBorrar,
  enLotes,
  impedimentoDeBaja,
  impedimentoDeBajaDeInstitucion,
  nombreParaBuscar,
  patronQueContiene,
  slugDeBaja,
} from "@/lib/baja-cuenta";

describe("confirmar con el email", () => {
  it("acepta el email escrito sin importar mayúsculas ni espacios de más", () => {
    assert.equal(confirmaElEmail("  Ana@Mail.com ", "ana@mail.com"), true);
    assert.equal(comparable("  Juan   Pérez "), "juan pérez");
  });

  it("rechaza otro email, uno incompleto y el vacío", () => {
    assert.equal(confirmaElEmail("ana@mail.co", "ana@mail.com"), false);
    assert.equal(confirmaElEmail("", "ana@mail.com"), false);
    assert.equal(confirmaElEmail("   ", ""), false);
  });
});

describe("a quién se puede dar de baja", () => {
  const base = { rol: "docente", esDemo: false, tieneCuenta: true, esElMismoAdmin: false };

  it("a un profesional con cuenta", () => {
    assert.equal(impedimentoDeBaja(base), null);
  });

  it("no a un perfil sin cuenta, de ejemplo, del equipo, de una institución ni a uno mismo", () => {
    assert.match(impedimentoDeBaja({ ...base, tieneCuenta: false }) ?? "", /sin cuenta/);
    assert.match(impedimentoDeBaja({ ...base, esDemo: true }) ?? "", /ejemplo/);
    assert.match(impedimentoDeBaja({ ...base, rol: "admin" }) ?? "", /no es de un profesional/);
    assert.match(impedimentoDeBaja({ ...base, rol: "institucion" }) ?? "", /no es de un profesional/);
    assert.match(impedimentoDeBaja({ ...base, esElMismoAdmin: true }) ?? "", /propia cuenta/);
  });
});

describe("buscar a la persona en textos sueltos", () => {
  it("escapa los comodines del propio texto", () => {
    assert.equal(patronQueContiene("Ana Pérez"), "%Ana Pérez%");
    assert.equal(patronQueContiene("100%_ok\\"), "%100\\%\\_ok\\\\%");
  });

  it("solo busca por nombre cuando es completo y no confundible con otros", () => {
    assert.equal(nombreParaBuscar("Juan", "Pérez García"), "Juan Pérez García");
    assert.equal(nombreParaBuscar("  Ana ", " Gil "), null, "con 7 letras en total todavía podría coincidir con otras personas");
    assert.equal(nombreParaBuscar("María Luciana", "Gómez"), "María Luciana Gómez");
    assert.equal(nombreParaBuscar("Ana", ""), null, "un solo nombre corto coincidiría con Mariana");
    assert.equal(nombreParaBuscar("", ""), null);
  });
});

describe("lotes", () => {
  it("parte una lista sin perder nada", () => {
    assert.deepEqual(enLotes([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(enLotes([], 100), []);
  });
});

describe("baja de una institución", () => {
  it("se confirma escribiendo exactamente el nombre, sin importar mayúsculas ni espacios de más", () => {
    assert.equal(confirmaElTexto("  colegio   san martín ", "Colegio San Martín"), true);
    assert.equal(confirmaElTexto("Colegio San Martin", "Colegio San Martín"), false);
    assert.equal(confirmaElTexto("", "Colegio San Martín"), false);
  });

  it("se puede dar de baja una institución real que todavía no lo está", () => {
    assert.equal(impedimentoDeBajaDeInstitucion({ esDemo: false, yaDeBaja: false }), null);
  });

  it("no una de ejemplo ni una que ya está dada de baja", () => {
    assert.match(impedimentoDeBajaDeInstitucion({ esDemo: true, yaDeBaja: false }) ?? "", /ejemplo/);
    assert.match(impedimentoDeBajaDeInstitucion({ esDemo: false, yaDeBaja: true }) ?? "", /ya está dada de baja/);
    // Si ya está dada de baja se lo dice antes que cualquier otra cosa.
    assert.match(impedimentoDeBajaDeInstitucion({ esDemo: true, yaDeBaja: true }) ?? "", /ya está dada de baja/);
  });

  it("de las cuentas del equipo solo se borran las de institución: nunca una admin ni la de quien procesa", () => {
    const cuentas = [
      { id: "dueña", rol: "institucion" },
      { id: "colega", rol: "institucion" },
      { id: "colega", rol: "institucion" },
      { id: "staff", rol: "admin" },
      { id: "yo", rol: "institucion" },
      { id: "docente", rol: "docente" },
    ];
    assert.deepEqual(cuentasDelEquipoParaBorrar(cuentas, "yo"), ["dueña", "colega"]);
    assert.deepEqual(cuentasDelEquipoParaBorrar([], "yo"), []);
  });

  it("el enlace de una institución dada de baja ya no lleva su nombre", () => {
    const slug = slugDeBaja("3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c");
    assert.equal(slug, "baja-3f2a9c1e5b7d");
    assert.match(slug, /^baja-[0-9a-f]{12}$/);
  });
});
