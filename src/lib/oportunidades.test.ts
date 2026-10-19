import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { urgentesPrimero } from "@/lib/oportunidades";

const o = (id: string, rapida: boolean, postulacion: unknown = null) => ({ id, rapida, postulacion });

describe("urgentesPrimero", () => {
  it("pone adelante las urgentes abiertas y deja el resto en el orden que traía", () => {
    const orden = urgentesPrimero([o("a", false), o("b", true), o("c", false), o("d", true)]).map((x) => x.id);
    assert.deepEqual(orden, ["b", "d", "a", "c"]);
  });

  it("una urgente a la que la persona ya se postuló no va primero", () => {
    const orden = urgentesPrimero([o("a", false), o("b", true, { texto: "Postulada" }), o("c", true)]).map((x) => x.id);
    assert.deepEqual(orden, ["c", "a", "b"]);
  });

  it("no toca la lista que recibe", () => {
    const original = [o("a", false), o("b", true)];
    urgentesPrimero(original);
    assert.deepEqual(original.map((x) => x.id), ["a", "b"]);
  });
});
