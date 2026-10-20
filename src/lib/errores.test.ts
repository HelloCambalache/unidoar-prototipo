import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resumenDeError } from "@/lib/errores";

describe("resumen de un error para el log", () => {
  it("de un error de consulta no deja el SQL ni los parámetros", () => {
    const causa = Object.assign(new Error('duplicate key value violates unique constraint "mensajes_contacto_pkey"'), { code: "23505" });
    const e = new Error("Failed query: insert into mensajes_contacto (email, mensaje) values ($1, $2)\nparams: ana@correo.com,Hola, quiero mi baja", { cause: causa });
    const r = resumenDeError(e);
    assert.equal(r, '[23505] duplicate key value violates unique constraint "mensajes_contacto_pkey"');
    assert.ok(!r.includes("ana@correo.com") && !r.includes("insert into") && !r.includes("quiero mi baja"));
  });

  it("si la consulta falla sin causa, igual no filtra los datos", () => {
    const r = resumenDeError(new Error("Failed query: select * from usuarios where email = $1\nparams: ana@correo.com"));
    assert.equal(r, "falló una consulta a la base");
  });

  it("de otro error deja su mensaje y su código", () => {
    assert.equal(resumenDeError(new Error("fetch failed")), "fetch failed");
    assert.equal(resumenDeError(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })), "[ECONNREFUSED] connect ECONNREFUSED");
  });

  it("acepta cualquier cosa que se haya lanzado y corta los mensajes larguísimos", () => {
    assert.equal(resumenDeError("texto suelto"), "texto suelto");
    assert.equal(resumenDeError(undefined), "undefined");
    assert.ok(resumenDeError(new Error("x".repeat(5000))).length <= 300);
  });
});
