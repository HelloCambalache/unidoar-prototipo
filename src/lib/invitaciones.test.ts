import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decidirInvitacion,
  MAX_INVITACIONES_A_PROFESIONALES_POR_DIA,
  motivoDeTopeDeInvitaciones,
  type OpcionInvitacion,
} from "@/lib/invitaciones";

const op = (id: string, estado: OpcionInvitacion["estado"] = "libre"): OpcionInvitacion => ({ id, puesto: `Puesto ${id}`, detalle: "", estado });

describe("a qué búsqueda se invita", () => {
  it("sin búsquedas abiertas, lo que corresponde es publicar una", () => {
    assert.deepEqual(decidirInvitacion([], null), { tipo: "sin-busquedas" });
    assert.deepEqual(decidirInvitacion([], "x"), { tipo: "sin-busquedas" });
  });

  it("con una sola búsqueda abierta se invita directo, esté como esté", () => {
    assert.deepEqual(decidirInvitacion([op("a")], null), { tipo: "directa", opcion: op("a") });
    assert.deepEqual(decidirInvitacion([op("a", "invitado")], "a"), { tipo: "directa", opcion: op("a", "invitado") });
  });

  it("con más de una SIEMPRE se pregunta, aunque se venga mirando una (antes invitaba directo a esa)", () => {
    const r = decidirInvitacion([op("a"), op("b")], "a");
    assert.equal(r.tipo, "elegir");
    assert.equal(decidirInvitacion([op("a"), op("b")], null).tipo, "elegir");
  });

  it("la búsqueda que se venía mirando va primera en la lista, y el resto conserva su orden", () => {
    const r = decidirInvitacion([op("a"), op("b"), op("c")], "c");
    assert.ok(r.tipo === "elegir");
    assert.deepEqual(r.opciones.map((o) => o.id), ["c", "a", "b"]);
    const sinContexto = decidirInvitacion([op("a"), op("b")], "no-existe");
    assert.ok(sinContexto.tipo === "elegir");
    assert.deepEqual(sinContexto.opciones.map((o) => o.id), ["a", "b"]);
  });

  it("si en la de contexto ya está invitada pero hay otra libre, se sigue ofreciendo elegir", () => {
    const r = decidirInvitacion([op("a", "invitado"), op("b")], "a");
    assert.ok(r.tipo === "elegir");
    assert.deepEqual(r.opciones.map((o) => [o.id, o.estado]), [["a", "invitado"], ["b", "libre"]]);
  });

  it("si ya está invitada o se postuló a todas, no hay nada que ofrecer", () => {
    assert.deepEqual(decidirInvitacion([op("a", "invitado"), op("b", "postulado")], "a"), { tipo: "ya-esta" });
  });
});

describe("tope diario de invitaciones a profesionales", () => {
  it("un uso normal no se entera", () => {
    assert.equal(motivoDeTopeDeInvitaciones(0), null);
    assert.equal(motivoDeTopeDeInvitaciones(10), null);
    assert.equal(motivoDeTopeDeInvitaciones(MAX_INVITACIONES_A_PROFESIONALES_POR_DIA - 1), null);
  });

  it("al llegar al máximo corta y lo explica", () => {
    const motivo = motivoDeTopeDeInvitaciones(MAX_INVITACIONES_A_PROFESIONALES_POR_DIA);
    assert.ok(motivo?.includes(String(MAX_INVITACIONES_A_PROFESIONALES_POR_DIA)));
    assert.ok(motivoDeTopeDeInvitaciones(500));
  });
});
