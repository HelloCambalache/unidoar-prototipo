import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cambiosDeVitrina, vitrinaSchema, type VitrinaAntes } from "./vitrina";

const antes: VitrinaAntes = {
  nombre: "Colegio San Martín",
  tipo: "Colegio privado",
  fundada: 1950,
  alumnos: 420,
  niveles: "Inicial, Primario",
  turnos: "Mañana",
  docentesPlanta: 30,
  descripcion: "Un colegio de barrio.",
  contactoNombre: "Ana Pérez",
  contactoRol: "Director/a",
  mision: null,
  vision: null,
  valores: ["Respeto", "Esfuerzo"],
  horarioAdministracion: null,
  logoUrl: null,
  portadaUrl: null,
  fotos: [{ url: "https://x.test/a.jpg", etiqueta: "Patio" }],
  novedades: [{ titulo: "Acto", texto: "Viernes", fecha: "2026-10-01" }],
};

/** Lo que manda el formulario cuando no se tocó nada, ya validado. */
const igualQueAntes = () =>
  vitrinaSchema.parse({
    portadaUrl: "",
    logoUrl: "",
    nombre: antes.nombre,
    tipo: antes.tipo,
    fundada: String(antes.fundada),
    alumnos: String(antes.alumnos),
    niveles: antes.niveles,
    turnos: antes.turnos,
    docentesPlanta: String(antes.docentesPlanta),
    descripcion: antes.descripcion,
    contactoNombre: antes.contactoNombre,
    contactoRol: antes.contactoRol,
    mision: "",
    vision: "",
    valores: antes.valores,
    horarioAdministracion: "",
    fotos: antes.fotos,
    novedades: antes.novedades,
  });

describe("cambiosDeVitrina (lo que queda en la actividad del equipo)", () => {
  it("no anota nada si no se tocó nada", () => {
    assert.deepEqual(cambiosDeVitrina(antes, igualQueAntes()), []);
  });

  it("anota solo los campos que cambiaron, con su nombre en castellano", () => {
    const d = { ...igualQueAntes(), nombre: "Colegio San Martín del Sur", turnos: "Mañana y tarde" };
    assert.deepEqual(cambiosDeVitrina(antes, d), ["nombre", "turnos"]);
  });

  it("no cuenta como cambio los espacios de más ni vacío contra null", () => {
    const d = { ...igualQueAntes(), nombre: `  ${antes.nombre}  ` };
    assert.deepEqual(cambiosDeVitrina(antes, d), []);
  });

  it("distingue logo y portada, valores, galería y novedades", () => {
    const d = {
      ...igualQueAntes(),
      logoUrl: "https://x.test/logo.png",
      valores: ["Respeto"],
      fotos: [],
      novedades: [],
    };
    assert.deepEqual(cambiosDeVitrina(antes, d), ["logo", "valores", "galería de fotos", "novedades"]);
  });

  it("nunca incluye los valores nuevos, solo los nombres", () => {
    const d = { ...igualQueAntes(), descripcion: "Texto secreto nuevo" };
    const cambios = cambiosDeVitrina(antes, d);
    assert.deepEqual(cambios, ["descripción"]);
    assert.ok(!cambios.join(" ").includes("secreto"));
  });
});
