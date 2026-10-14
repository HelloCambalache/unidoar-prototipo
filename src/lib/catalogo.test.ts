import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { institucionDatosSchema } from "@/lib/catalogo";

/** Lo que manda el formulario del paso 2 del alta de institución (sin la casilla de términos, que ya se aceptó en el paso 1). */
const FORMULARIO = {
  nombre: "Colegio San Andrés",
  tipo: "Colegio privado",
  fundada: "1985",
  contactoNombre: "Marta Gómez",
  contactoRol: "Docente",
  telefono: "11 5555 1234",
  cuit: "",
  cue: "",
  direccion: "Av. Maipú 1234",
  partido: "Vicente López",
  provincia: "Buenos Aires",
};

describe("datos de la institución (paso 2 del alta)", () => {
  it("se puede completar sin la casilla de términos: quien ya los aceptó en el paso 1 no la ve", () => {
    const r = institucionDatosSchema.safeParse(FORMULARIO);
    assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues));
  });

  it("con la casilla tildada (cuentas que todavía no aceptaron) también pasa", () => {
    assert.equal(institucionDatosSchema.safeParse({ ...FORMULARIO, aceptaTerminos: "on" }).success, true);
  });

  it("sigue exigiendo lo que corresponde", () => {
    assert.equal(institucionDatosSchema.safeParse({ ...FORMULARIO, nombre: "" }).success, false);
    assert.equal(institucionDatosSchema.safeParse({ ...FORMULARIO, direccion: "" }).success, false);
    assert.equal(institucionDatosSchema.safeParse({ ...FORMULARIO, tipo: "Inventado" }).success, false);
  });
});
