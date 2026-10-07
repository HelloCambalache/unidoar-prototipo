import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CSV_MODELO, claveDeTelefono, contactoSchema, digitosDeTelefono, filasDeCsv, parsearCsv, validarFilas } from "@/lib/contactos";

describe("lectura del CSV", () => {
  it("parte filas y celdas, con CRLF y fila final sin salto", () => {
    assert.deepEqual(parsearCsv("a,b,c\r\n1,2,3\r\n"), [["a", "b", "c"], ["1", "2", "3"]]);
    assert.deepEqual(parsearCsv("a,b\n1,"), [["a", "b"], ["1", ""]]);
  });

  it("elige el separador: punto y coma (Excel en español) o tabulación", () => {
    assert.deepEqual(parsearCsv("﻿a;b;c\n1;2;3"), [["a", "b", "c"], ["1", "2", "3"]]);
    assert.deepEqual(parsearCsv("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
  });

  it("entiende comillas, comas y saltos de línea dentro de una celda", () => {
    assert.deepEqual(parsearCsv('n,nota\n"Pérez, Ana","dijo ""hola"""'), [["n", "nota"], ["Pérez, Ana", 'dijo "hola"']]);
    assert.deepEqual(parsearCsv('n,nota\nAna,"línea 1\nlínea 2"\nLuis,x'), [["n", "nota"], ["Ana", "línea 1\nlínea 2"], ["Luis", "x"]]);
  });

  it("reconoce variantes de los títulos y numera las filas como la planilla", () => {
    const r = filasDeCsv(
      "Nombre y apellido;Correo;Celular;Materia;Observaciones\nMaría Gómez;MARIA@Ejemplo.com;11 4455-3320;Natación;la conoce la directora\n;;;;\nJulián Pérez;;11 5566-7788;;\n",
    );
    assert.equal(r.error, null);
    assert.deepEqual(
      r.filas.map((x) => [x.linea, x.nombre, x.email, x.telefono, x.disciplina, x.nota]),
      [
        [2, "María Gómez", "MARIA@Ejemplo.com", "11 4455-3320", "Natación", "la conoce la directora"],
        [4, "Julián Pérez", "", "11 5566-7788", "", ""],
      ],
    );
  });

  it("junta nombre y apellido cuando vienen en columnas separadas", () => {
    assert.equal(filasDeCsv("Nombre,Apellido,Email\nAna,López,ana@x.com").filas[0]!.nombre, "Ana López");
  });

  it("explica qué falta cuando los títulos no alcanzan", () => {
    assert.match(filasDeCsv("email,telefono\na@x.com,111111").error ?? "", /columna del nombre/);
    assert.match(filasDeCsv("nombre,disciplina\nAna,Yoga").error ?? "", /email o la del teléfono/);
    assert.match(filasDeCsv("").error ?? "", /vacío/);
  });

  it("un archivo con solo los títulos no trae filas", () => {
    assert.equal(filasDeCsv("nombre,email\n").filas.length, 0);
  });

  it("el modelo descargable es válido", () => {
    const modelo = filasDeCsv(CSV_MODELO);
    assert.equal(modelo.error, null);
    const v = validarFilas(modelo.filas);
    assert.deepEqual([v.validas.length, v.errores.length], [2, 0]);
  });
});

describe("validación de un contacto", () => {
  it("pide nombre y al menos un email o un teléfono", () => {
    assert.equal(contactoSchema.safeParse({ nombre: "Ana", telefono: "11 4455 3320" }).success, true);
    assert.equal(contactoSchema.safeParse({ nombre: "Ana", email: "a@b.co" }).success, true);
    assert.equal(contactoSchema.safeParse({ nombre: "Ana" }).success, false);
    assert.equal(contactoSchema.safeParse({ nombre: "A", email: "a@b.co" }).success, false);
  });

  it("trata los campos vacíos como ausentes y guarda el email en minúsculas", () => {
    const r = contactoSchema.safeParse({ nombre: "  Ana  ", email: "  ", telefono: "11 4455 3320", nota: "" });
    assert.equal(r.success, true);
    const m = contactoSchema.safeParse({ nombre: "Ana", email: " ANA@Ejemplo.COM " });
    assert.equal(m.success && m.data.email, "ana@ejemplo.com");
  });

  it("valida el email y el largo del teléfono", () => {
    assert.equal(contactoSchema.safeParse({ nombre: "Ana", email: "no-es-un-mail" }).success, false);
    assert.equal(contactoSchema.safeParse({ nombre: "Ana", telefono: "12345" }).success, false);
    assert.equal(contactoSchema.safeParse({ nombre: "Ana", telefono: "abc def ghi" }).success, false);
    assert.equal(contactoSchema.safeParse({ nombre: "Ana", telefono: "1".repeat(16) }).success, false);
    assert.equal(contactoSchema.safeParse({ nombre: "Ana", telefono: "+54 9 11 4455-3320" }).success, true);
  });

  it("limita el largo de la nota", () => {
    assert.equal(contactoSchema.safeParse({ nombre: "Ana", email: "a@b.co", nota: "x".repeat(501) }).success, false);
  });
});

describe("teléfonos", () => {
  it("las distintas formas de escribir un mismo número dan la misma clave", () => {
    const mismo = ["11 4455-3320", "011 4455 3320", "(011) 15 4455 3320", "+54 9 11 4455-3320", "541144553320", "1144553320"];
    assert.equal(new Set(mismo.map(claveDeTelefono)).size, 1);
  });

  it("números distintos dan claves distintas", () => {
    assert.notEqual(claveDeTelefono("11 4455-3320"), claveDeTelefono("11 4455-3321"));
    assert.notEqual(claveDeTelefono("11 4455-3320"), claveDeTelefono("221 455-3320"));
  });

  it("un teléfono que no es argentino se compara por los números a secas", () => {
    assert.equal(claveDeTelefono("+1 (415) 555-0100"), claveDeTelefono("14155550100"));
    assert.equal(digitosDeTelefono("+54 (011) 4455-3320"), "5401144553320");
  });
});

describe("validación de las filas de un archivo", () => {
  const fila = (linea: number, nombre: string, email = "", telefono = "") => ({ linea, nombre, email, telefono, disciplina: "", nota: "" });

  it("separa válidas, con error y repetidas dentro del archivo", () => {
    const v = validarFilas([
      fila(2, "Ana Pérez", "ANA@Ejemplo.com", "11 4455-3320"),
      fila(3, "Ana P.", "ana@ejemplo.com"),
      fila(4, "Luis Sosa", "", "+54 9 11 4455-3320"),
      fila(5, "Luis S.", "", "(011) 15 4455 3320"),
      fila(6, "X", "x@x.com"),
      fila(7, "Sin contacto"),
      fila(8, "Mail roto", "no-es-un-mail"),
      fila(9, "Tel roto", "", "abc"),
      fila(10, "Tel corto", "", "12345"),
    ]);
    assert.deepEqual(v.validas.map((c) => c.linea), [2, 4]);
    assert.equal(v.validas[0]!.email, "ana@ejemplo.com");
    assert.equal(v.repetidasEnArchivo, 2);
    assert.deepEqual(v.errores.map((e) => e.linea), [6, 7, 8, 9, 10]);
    assert.match(v.errores.find((e) => e.linea === 7)!.mensaje, /email o un teléfono/);
    assert.match(v.errores.find((e) => e.linea === 10)!.mensaje, /6 y 15 números/);
  });
});
