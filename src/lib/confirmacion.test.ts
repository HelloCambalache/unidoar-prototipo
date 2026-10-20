import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dividirMensaje, TITULO_GENERICO } from "@/lib/confirmacion";

describe("mensaje de confirmación → título y detalle", () => {
  it("una pregunta sola es el título y no hay detalle", () => {
    assert.deepEqual(dividirMensaje("¿Cancelar el pedido de cambio de plan?"), { titulo: "¿Cancelar el pedido de cambio de plan?", detalle: null });
  });

  it("si empieza con una pregunta, lo que sigue es el detalle", () => {
    assert.deepEqual(dividirMensaje("¿Quitar a Ana del equipo? Va a perder el acceso a la cuenta de la institución."), {
      titulo: "¿Quitar a Ana del equipo?",
      detalle: "Va a perder el acceso a la cuenta de la institución.",
    });
  });

  it("si termina con una pregunta, lo anterior es el detalle", () => {
    assert.deepEqual(dividirMensaje("En la plataforma no figura: el DNI (frente y dorso). ¿Verificar a Ana Pérez igual?"), {
      titulo: "¿Verificar a Ana Pérez igual?",
      detalle: "En la plataforma no figura: el DNI (frente y dorso).",
    });
    assert.deepEqual(dividirMensaje("«Yoga» tiene 3 inscriptos. Si lo borrás, se les avisa. Esto no se puede deshacer. ¿Borrarlo?"), {
      titulo: "¿Borrarlo?",
      detalle: "«Yoga» tiene 3 inscriptos. Si lo borrás, se les avisa. Esto no se puede deshacer.",
    });
  });

  it("sin una pregunta corta, el título es genérico y el mensaje entero es el detalle", () => {
    assert.deepEqual(dividirMensaje("Se va a borrar el archivo."), { titulo: TITULO_GENERICO, detalle: "Se va a borrar el archivo." });
    const larga = `¿${"x".repeat(200)}? Y algo más.`;
    assert.deepEqual(dividirMensaje(larga), { titulo: TITULO_GENERICO, detalle: larga });
  });

  it("un mensaje vacío no rompe", () => {
    assert.deepEqual(dividirMensaje(""), { titulo: TITULO_GENERICO, detalle: null });
    assert.deepEqual(dividirMensaje("   "), { titulo: TITULO_GENERICO, detalle: null });
  });

  it("no pierde texto y junta los espacios de más", () => {
    for (const m of [
      "¿Borrar a Ana de tus contactos? Esto no se puede deshacer.",
      "Hay un cambio sin guardar. ¿Salir igual?",
      "¿Pedir el cambio al Plan Colegios ($ 50.000/mes)? No se cobra ni se modifica nada ahora.",
    ]) {
      const { titulo, detalle } = dividirMensaje(m);
      const juntos = [titulo, detalle].filter(Boolean).sort().join(" ");
      const original = m.replace(/\s+/g, " ").trim();
      for (const parte of [titulo, detalle].filter(Boolean) as string[]) assert.ok(original.includes(parte), parte);
      assert.equal(juntos.length >= original.length - 1, true, m);
    }
    assert.deepEqual(dividirMensaje("¿Borrar   a Ana?    Sin   vuelta."), { titulo: "¿Borrar a Ana?", detalle: "Sin vuelta." });
  });
});
